// tree-selector.ts

import { Primitive } from "../../types-consts";
import { ListenerBuilder, ListenerSub } from "../../types-consts/listen.types";
import { TagName } from "../../types-consts/tree.types";
import { cssForQuids, CssHandle } from "./livetree-methods/css-manager";
import { DataManager2, DatasetObj, DatasetValue } from "./livetree-methods/data-manager2.tree";
import { buildListener } from "./livetree-methods/listen2";
import { StyleManager2, StyleObject2 } from "./livetree-methods/style-manager2.utils";
import { LiveTree2 } from "./livetree2";


//  thin wrapper around an array of LiveTree2 with a limited,
// broadcast-style API. This is the “multi”/selector type.
export interface TreeSelector {
  // collection-ish surface
  toArray(): LiveTree2[];
  forEach(fn: (tree: LiveTree2, index: number) => void): void;
  map<T>(fn: (tree: LiveTree2, index: number) => T): T[];
  count(): number;
  at(index: number): LiveTree2 | undefined;

  // attrs: broadcast to all trees, but keep the selector for chaining
  setAttrs(
    name: string,
    value: string | boolean | null,
  ): TreeSelector;
  setAttrs(
    map: Record<string, string | boolean | null>,
  ): TreeSelector;
  removeAttr(name: string): TreeSelector;

  // flags: broadcast to all trees
  setFlags(...names: string[]): TreeSelector;
  removeFlags(...names: string[]): TreeSelector;

  // style: proxied to the *first* tree; throws on empty
  readonly style: StyleManager2;
  readonly css: CssHandle;
  readonly data: DataManager2;
  readonly listen: ListenerBuilder;


  // structural sugar: create children under each selected tree and
  // keep returning the same selector
  createTag(tag: TagName | TagName[]): TreeSelector;
}

//  factory that builds a TreeSelector over a set of LiveTree2s
export function makeTreeSelector(trees: LiveTree2[]): TreeSelector {
  //  defensive copy to avoid external mutation
  const firstTree = (): LiveTree2 => {
    if (!items.length) {
      throw new Error("[TreeSelector.style] no items in selector");
    }
    return items[0];
  };

  const items: LiveTree2[] = [...trees];

  const result: TreeSelector = {
    toArray(): LiveTree2[] {
      //  return a fresh copy, keep internal array private
      return [...items];
    },

    forEach(fn): void {
      for (let i = 0; i < items.length; i += 1) {
        fn(items[i], i);
      }
    },

    map<T>(fn: (tree: LiveTree2, index: number) => T): T[] {
      const out: T[] = [];
      for (let i = 0; i < items.length; i += 1) {
        out.push(fn(items[i], i));
      }
      return out;
    },

    count(): number {
      return items.length;
    },

    at(index: number): LiveTree2 | undefined {
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
      (proxy as any).setMulti = (block: StyleObject2): LiveTree2 => {
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
        return cssForQuids([]);
      }

      const quids: string[] = [];
      for (const tree of items) {
        const q = tree.quid;      // assumes LiveTree2 has a `quid` getter
        if (q) quids.push(q);
      }
      return cssForQuids(quids);
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
    createTag(tag: TagName | TagName[]): TreeSelector {
      if (Array.isArray(tag)) {
        items.forEach(tree => tree.createAppend(tag as TagName[]));
      } else {
        items.forEach(tree => tree.createAppend(tag as TagName));
      }
      return result;
    }
  };

  return result;
}
function makeMultiStyleManager(items: LiveTree2[]): StyleManager2 {
  const firstTree = (): LiveTree2 => {
    const t = items[0];
    if (!t) {
      throw new Error("TreeSelector.style: empty selection");
    }
    return t;
  }

  return {
    // --- core example method ---
    setProperty(name: string, value: string | number | null): LiveTree2 {
      for (const t of items) {
        t.style.setProperty(name, value);
      }
      // preserve StyleManager2’s “return LiveTree2 for chaining” contract
      return firstTree();
    },

    replace(map: StyleObject2): LiveTree2 {
      for (const t of items) {
        t.style.replace(map);
      }
      return firstTree();
    },


  } as StyleManager2;
}

function makeMultiDataManager(items: LiveTree2[]): DataManager2 {
  const firstTree = (): LiveTree2 => {
    const t = items[0];
    if (!t) {
      throw new Error("TreeSelector.data: empty selection");
    }
    return t;
  };

  return {
    // example assuming these exist on DataManager2:
    set(key: string, value: DatasetValue): LiveTree2 {
      for (const t of items) {
        t.data.set(key, value);
      }
      return firstTree();
    },

    setMulti(map: DatasetObj): LiveTree2 {
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
function makeMultiListener(items: LiveTree2[]): ListenerBuilder {
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