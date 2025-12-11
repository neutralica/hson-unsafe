// tree-selector.ts

import { ListenerBuilder, ListenerSub } from "../../types-consts/listen.types";
import { LiveTreeCreateHelper, TagName, TreeSelectorCreateHelper } from "../../types-consts/livetree.types";
import { css_for_quids } from "./livetree-methods/css-manager";
import { CssHandle } from "../../types-consts/css.types";
import { DataManager2, DatasetObj, DatasetValue } from "./livetree-methods/data-manager2.tree";
import { buildListener } from "./livetree-methods/listen2";
import { StyleManager2 } from "./livetree-methods/style-manager2.utils";
import { StyleObject } from "../../types-consts/css.types";
import { LiveTree } from "./livetree";
import { TreeSelector } from "../../types-consts/livetree.types";
import { Primitive } from "../../core/types-consts/core.types";
import { make_selector_create, make_tree_create } from "./livetree-methods/create-typed";


//  factory that builds a TreeSelector over a set of LiveTree2s
export function make_tree_selector(trees: LiveTree[]): TreeSelector {
  //  defensive copy to avoid external mutation
  const firstTree = (): LiveTree => {
    if (!items.length) {
      throw new Error("[TreeSelector.style] no items in selector");
    }
    return items[0];
  };

  const items: LiveTree[] = [...trees];

  const result: TreeSelector = {
    toArray(): LiveTree[] {
      //  return a fresh copy, keep internal array private
      return [...items];
    },

    forEach(fn): void {
      for (let i = 0; i < items.length; i += 1) {
        fn(items[i], i);
      }
    },

    map<T>(fn: (tree: LiveTree, index: number) => T): T[] {
      const out: T[] = [];
      for (let i = 0; i < items.length; i += 1) {
        out.push(fn(items[i], i));
      }
      return out;
    },

    count(): number {
      return items.length;
    },

    at(index: number): LiveTree | undefined {
      if (index < 0 || index >= items.length) {
        return undefined;
      }
      return items[index];
    },

    // --- attrs broadcast ---
    setAttrs(nameOrMap: any, value?: any): TreeSelector {
      if (typeof nameOrMap === "string") {
        for (const t of items) {
          t.setAttrs(nameOrMap, value);
        }
      } else {
        for (const t of items) {
          t.setAttrs(nameOrMap);
        }
      }
      return result;
    },
    removeAttr(name: string): TreeSelector {
      for (const t of items) {
        t.removeAttr(name);
      }
      return result;
    },
    //  broadcast flags
    setFlags(...names: string[]): TreeSelector {
      items.forEach(tree => tree.setFlags(...names));
      return result;
    },
    removeFlags(...names: string[]): TreeSelector {
      for (const t of items) {
        t.removeFlags(...names);
      }
      return result;
    },

    //  style proxy to the first item

    // --- style: broadcast wrapper over first.style ---
    get style(): StyleManager2 {
      const first = firstTree();
      const base = first.style;

      // Clone the StyleManager surface
      const proxy = Object.create(base) as StyleManager2;

      // Override ONLY setMulti to broadcast
      (proxy as any).setMulti = (block: StyleObject): LiveTree => {
        for (const t of items) {
          t.style.setMulti(block);
        }
        // maintain the existing return contract (LiveTree2)
        return first.style.setMulti(block);
      };

      return proxy;
    },

    // QUID-scoped stylesheet: aggregate all quids
    get css(): CssHandle {
      // empty selection → safe no-op handle
      if (items.length === 0) {
        return css_for_quids([]);
      }

      const quids: string[] = [];
      for (const tree of items) {
        const q = tree.quid;      // assumes LiveTree2 has a `quid` getter
        if (q) quids.push(q);
      }
      return css_for_quids(quids);
    },
    // dataset – broadcast wrapper, same pattern as style
    get data(): DataManager2 {
      return makeMultiDataManager(items);
    },
    get listen(): ListenerBuilder {
      return makeMultiListener(items);
    },
    //  broadcast createAppend across selection, then return selector
    // NOTE: assumes LiveTree2 has a `createAppend(tag)` method.
    // createTag(tag: TagName | TagName[]): TreeSelector {
    //   if (Array.isArray(tag)) {
    //     items.forEach(tree => tree.createAppend(tag as TagName[]));
    //   } else {
    //     items.forEach(tree => tree.createAppend(tag as TagName));
    //   }
    //   return result;
    // }
    get create(): TreeSelectorCreateHelper {
      return make_selector_create(items);
    }
  };

  return result;
}

function makeMultiStyleManager(items: LiveTree[]): StyleManager2 {
  const firstTree = (): LiveTree => {
    const t = items[0];
    if (!t) {
      throw new Error("TreeSelector.style: empty selection");
    }
    return t;
  }

  return {
    // --- core example method ---
    setProperty(name: string, value: string | number | null): LiveTree {
      for (const t of items) {
        t.style.setProperty(name, value);
      }
      // preserve StyleManager2’s “return LiveTree2 for chaining” contract
      return firstTree();
    },

    replace(map: StyleObject): LiveTree {
      for (const t of items) {
        t.style.replace(map);
      }
      return firstTree();
    },


  } as StyleManager2;
}

function makeMultiDataManager(items: LiveTree[]): DataManager2 {
  const firstTree = (): LiveTree => {
    const t = items[0];
    if (!t) {
      throw new Error("TreeSelector.data: empty selection");
    }
    return t;
  };

  return {
    // example assuming these exist on DataManager2:
    set(key: string, value: DatasetValue): LiveTree {
      for (const t of items) {
        t.data.set(key, value);
      }
      return firstTree();
    },

    setMulti(map: DatasetObj): LiveTree {
      for (const t of items) {
        t.data.setMulti(map);
      }
      return firstTree();
    },

    get(key: string): Primitive | undefined {
      // read semantics: first tree as canonical value
      return firstTree().data.get(key);
    },

    // …extend with whatever else DataManager2 exposes,
    // always broadcasting writes and reading from firstTree()
  } as DataManager2;
}
function makeMultiListener(items: LiveTree[]): ListenerBuilder {
  // No items: return a fully-typed no-op builder that still chains.
  if (items.length === 0) {
    const noopSub: ListenerSub = {
      count: 0,
      ok: false,
      off() {
        /* no-op */
      },
    };

    const noop: ListenerBuilder = {
      on() { return noop; },
      onClick() { return noop; },
      onMouseMove() { return noop; },
      onMouseDown() { return noop; },
      onMouseUp() { return noop; },
      onKeyDown() { return noop; },
      onKeyUp() { return noop; },

      once() { return noop; },
      passive() { return noop; },
      capture() { return noop; },
      toWindow() { return noop; },
      toDocument() { return noop; },

      strict() { return noop; },
      defer() { return noop; },

      attach() { return noopSub; },

      preventDefault() { return noop; },
      stopProp() { return noop; },
      stopImmediateProp() { return noop; },
      stopAll() { return noop; },
      clearStops() { return noop; },
    };

    return noop;
  }

  // One real ListenerBuilder per LiveTree2
  const builders = items.map(tree => buildListener(tree));

  // Multi-builder that just fans calls out to each underlying builder
  const multi: ListenerBuilder = {
    on(type, handler) {
      builders.forEach(b => b.on(type as any, handler as any));
      return multi;
    },
    onClick(handler) {
      builders.forEach(b => b.onClick(handler));
      return multi;
    },
    onMouseMove(handler) {
      builders.forEach(b => b.onMouseMove(handler));
      return multi;
    },
    onMouseDown(handler) {
      builders.forEach(b => b.onMouseDown(handler));
      return multi;
    },
    onMouseUp(handler) {
      builders.forEach(b => b.onMouseUp(handler));
      return multi;
    },
    onKeyDown(handler) {
      builders.forEach(b => b.onKeyDown(handler));
      return multi;
    },
    onKeyUp(handler) {
      builders.forEach(b => b.onKeyUp(handler));
      return multi;
    },

    once() {
      builders.forEach(b => b.once());
      return multi;
    },
    passive() {
      builders.forEach(b => b.passive());
      return multi;
    },
    capture() {
      builders.forEach(b => b.capture());
      return multi;
    },
    toWindow() {
      builders.forEach(b => b.toWindow());
      return multi;
    },
    toDocument() {
      builders.forEach(b => b.toDocument());
      return multi;
    },

    strict(policy) {
      builders.forEach(b => b.strict(policy));
      return multi;
    },
    defer() {
      builders.forEach(b => b.defer());
      return multi;
    },

    attach(): ListenerSub {
      let total = 0;
      const subs: ListenerSub[] = [];

      for (const b of builders) {
        const sub = b.attach();
        subs.push(sub);
        total += sub.count;
      }

      return {
        count: total,
        ok: total > 0,
        off() {
          subs.forEach(s => s.off());
        },
      };
    },

    preventDefault() {
      builders.forEach(b => b.preventDefault());
      return multi;
    },
    stopProp() {
      builders.forEach(b => b.stopProp());
      return multi;
    },
    stopImmediateProp() {
      builders.forEach(b => b.stopImmediateProp());
      return multi;
    },
    stopAll() {
      builders.forEach(b => b.stopAll());
      return multi;
    },
    clearStops() {
      builders.forEach(b => b.clearStops());
      return multi;
    },
  };

  return multi;
}