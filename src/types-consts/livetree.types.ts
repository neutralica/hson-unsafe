// livetree2.types.ts

import { LiveTree } from "../api/livetree/livetree";
import { CssHandle } from "./css.types";
import { DataManager } from "../api/livetree/livetree-methods/data-manager2.tree";
import { StyleManager2 } from "../api/livetree/livetree-methods/style-manager2.utils";
import { ListenerBuilder } from "./listen.types";
import { HsonAttrs, HsonMeta, HsonNode } from "./node.types";
import { HtmlTag } from "../api/livetree/livetree-methods/create-typed";
import { Primitive } from "../core/types-consts/core.types";

export interface HsonQuery {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  meta?: Partial<HsonMeta>;
  text?: string | RegExp;
}


export interface NodeRef {
  q: string;                        // QUID
  resolveNode(): HsonNode | undefined;
  resolveElement(): Element | undefined;
}

// Callable finder set (like your current FindWithById)
export interface FindWithById {
  (q: HsonQuery | string): LiveTree | undefined;
  byId(id: string): LiveTree | undefined;
  must(q: HsonQuery | string, label?: string): LiveTree;
  mustById(id: string, label?: string): LiveTree;
}

export interface LiveTreeCreateAppend {
  (tag: TagName, index?: number): LiveTree;
  (tags: TagName[], index?: number): TreeSelector;
}

export type TagName = keyof HTMLElementTagNameMap;
//  thin wrapper around an array of LiveTree2 with a limited,
// broadcast-style API. This is the “multi”/selector type.

export interface TreeSelector {
  // collection-ish surface
  toArray(): LiveTree[];
  forEach(fn: (tree: LiveTree, index: number) => void): void;
  map<T>(fn: (tree: LiveTree, index: number) => T): T[];
  count(): number;
  at(index: number): LiveTree | undefined;

  // attrs: broadcast to all trees, but keep the selector for chaining
  setAttrs(
    name: string,
    value: string | boolean | null
  ): TreeSelector;
  setAttrs(
    map: Record<string, string | boolean | null>
  ): TreeSelector;
  removeAttr(name: string): TreeSelector;

  // flags: broadcast to all trees
  setFlags(...names: string[]): TreeSelector;
  removeFlags(...names: string[]): TreeSelector;

  // style: proxied to the *first* tree; throws on empty
  readonly style: StyleManager2;
  readonly css: CssHandle;
  readonly data: DataManager;
  readonly listen: ListenerBuilder;
  create: TreeSelectorCreateHelper;
  /**
   * Set the text content of every `LiveTree` in this selector.
   *
   * Semantics:
   * - Iterates over the internal list of trees and calls `t.setText(value)`
   *   on each one, so each selected node is updated via the same HSON +
   *   DOM sync path as a single-tree call.
   * - The selection itself is not changed: after this call, the selector
   *   still refers to the same `LiveTree` instances, now with updated text.
   *
   * This is a broadcast side-effect: it performs a write operation on
   * each subtree and then returns the same selector for further chaining.
   *
   * @param value - The primitive text value to apply to each selected node.
   * @returns This `TreeSelector` instance, for chaining.
   */
  setText(value: Primitive): TreeSelector;
}

export type CreateHelper<Single, Many> = {
  // per-tag sugar: .create.div(index?)
  [K in HtmlTag]: (index?: number) => Single;
} & {
  // batch: .create.tags(["div", "span"], index?)
  tags(tags: TagName[], index?: number): Many;
};

/**
 * Helper interface used for `tree.create`, providing declarative element
 * construction without mutating the DOM.
 *
 * Structure:
 * - Per-tag sugar (e.g. `tree.create.div(index?)`) returns a `LiveTree`
 *   containing a freshly parsed HSON element that has *not* yet been appended
 *   to anything.
 * - The `tags([...], index?)` batch form returns a `TreeSelector` containing
 *   multiple such `LiveTree` instances.
 *
 * Intended use:
 * - Acts as a factory for *unattached* subtrees that the caller will usually
 *   pass to `.append()`, `.appendMulti()`, etc.
 * - Mirrors the DOM’s element creation ergonomics without requiring direct use
 *   of raw HTML strings.
 */
export type LiveTreeCreateHelper = CreateHelper<LiveTree, TreeSelector>;
export type TreeSelectorCreateHelper = CreateHelper<TreeSelector, TreeSelector>;
