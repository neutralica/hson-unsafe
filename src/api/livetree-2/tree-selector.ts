// tree-selector.ts

import { TagName } from "../../types-consts/tree.types";
import { StyleManager2 } from "./livetree-methods/style-manager2.utils";
import { LiveTree2 } from "./livetree2";


// comment: thin wrapper around an array of LiveTree2 with a limited,
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

  // structural sugar: create children under each selected tree and
  // keep returning the same selector
  createAppend(tag: TagName | TagName[]): TreeSelector;
}

// comment: factory that builds a TreeSelector over a set of LiveTree2s
export function makeTreeSelector(trees: LiveTree2[]): TreeSelector {
  // comment: defensive copy to avoid external mutation
  const items: LiveTree2[] = [...trees];

  const result: TreeSelector = {
    toArray(): LiveTree2[] {
      // comment: return a fresh copy, keep internal array private
      return [...items];
    },

    forEach(fn): void {
      for (let i = 0; i < items.length; i += 1) {
        fn(items[i], i);
      }
    },

    map<T>(fn: (tree: LiveTree2, index: number) => T): T[]{
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

    // comment: broadcast setAttrs over all selected trees
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

    // comment: broadcast flags
    setFlags(...names: string[]): TreeSelector {
      items.forEach(tree => tree.setFlags(...names));
      return result;
    },

    // comment: style proxy to the first item
    get style(): StyleManager2 {
      const first = items[0];
      if (!first) {
        throw new Error("TreeSelector.style: empty selection");
      }
      return first.style;
    },

    // comment: broadcast createAppend across selection, then return selector
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