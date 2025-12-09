// tree-selector.ts

import { Primitive } from "../../types-consts";
import { TagName } from "../../types-consts/tree.types";
import { cssForQuids, CssHandle } from "./livetree-methods/css-manager";
import { DataManager2, DatasetObj, DatasetValue } from "./livetree-methods/data-manager2.tree";
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

  // flags: broadcast to all trees
  setFlags(...names: string[]): TreeSelector;

  // style: proxied to the *first* tree; throws on empty
  readonly style: StyleManager2;
  readonly css: CssHandle;
  readonly data: DataManager2;

  // structural sugar: create children under each selected tree and
  // keep returning the same selector
  createAppend(tag: TagName | TagName[]): TreeSelector;
}

//  factory that builds a TreeSelector over a set of LiveTree2s
export function makeTreeSelector(trees: LiveTree2[]): TreeSelector {
  //  defensive copy to avoid external mutation
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

    //  broadcast setAttrs over all selected trees
    setAttrs(
      nameOrMap: string | Record<string, string | boolean | null>,
      value?: string | boolean | null,
    ): TreeSelector {
      if (typeof nameOrMap === "string") {
        const attrName = nameOrMap;
        items.forEach(tree => tree.setAttrs(attrName, value ?? null));
      } else {
        const map = nameOrMap;
        items.forEach(tree => tree.setAttrs(map));
      }
      return result;
    },

    //  broadcast flags
    setFlags(...names: string[]): TreeSelector {
      items.forEach(tree => tree.setFlags(...names));
      return result;
    },

    //  style proxy to the first item
    get style(): StyleManager2 {
      const first = items[0];
      if (!first) {
        throw new Error("TreeSelector.style: empty selection");
      }
      return first.style;
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

    //  broadcast createAppend across selection, then return selector
    // NOTE: assumes LiveTree2 has a `createAppend(tag)` method.
    createAppend(tag: TagName | TagName[]): TreeSelector {
      items.forEach(tree => {
        tree.createAppend(tag);
      });
      return result;
    },
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