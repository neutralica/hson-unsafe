// livetree2.types.ts

import { LiveTree } from "../api/livetree/livetree";
import { CssHandle } from "./css.types";
import { DataManager } from "../api/livetree/livetree-methods/data-manager2.tree";
import { StyleManager } from "../api/livetree/livetree-methods/style-manager2.utils";
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
  /**
    * Return a shallow copy of the underlying `LiveTree` array.
    *
    * This provides read-only snapshot access to the current selection
    * without exposing the internal backing array to accidental mutation.
    *
    * @returns A new array containing all `LiveTree` items in the selector.
    */
  toArray(): LiveTree[];
  /**
    * Invoke a callback for every `LiveTree` in the selector.
    *
    * The callback receives both the `LiveTree` instance and its numeric
    * index in the current selection, mirroring `Array.prototype.forEach`.
    *
    * @param fn - Callback invoked for each tree and its index.
    */
  forEach(fn: (tree: LiveTree, index: number) => void): void;
  /**
     * Transform the current selection into an array of values using the
     * provided mapping function.
     *
     * This mirrors `Array.prototype.map` but operates directly on the
     * selector's internal list rather than requiring an explicit call
     * to `toArray()`.
     *
     * @typeParam T - The element type produced by the mapping function.
     * @param fn - Mapping function applied to each tree and its index.
     * @returns An array of mapped values.
     */
  map<T>(fn: (tree: LiveTree, index: number) => T): T[];
  /**
    * Return the number of `LiveTree` items in the selector.
    *
    * @returns The current selection size.
    */
  count(): number;
  /**
    * Retrieve the `LiveTree` at the given index, if present.
    *
    * Out-of-bounds indexes return `undefined` rather than throwing.
    *
    * @param index - Zero-based index into the selection.
    * @returns The `LiveTree` at that index, or `undefined` if out of range.
    */
  at(index: number): LiveTree | undefined;

  /**
   * Set one or more attributes on every `LiveTree` in this selector.
   *
   * Overloads:
   * - When `nameOrMap` is a string, forwards to `t.setAttrs(nameOrMap, value)`
   *   on each tree.
   * - When `nameOrMap` is a record, forwards to `t.setAttrs(nameOrMap)` so each
   *   tree receives all key/value pairs.
   *
   * Semantics are identical to `LiveTree.setAttrs`, applied to all selected
   * nodes. The selection itself is not changed.
   *
   * @param nameOrMap - Attribute name or map of attribute names to values.
   * @param value - Attribute value when setting a single attribute by name.
   * @returns This `TreeSelector` instance, for chaining.
   * @see LiveTree.setAttrs
   */
  setAttrs(
    name: string,
    value: string | boolean | null
  ): TreeSelector;
  setAttrs(
    map: Record<string, string | boolean | null>
  ): TreeSelector;

  /**
    * Remove a single attribute from every `LiveTree` in this selector.
    *
    * For each tree, forwards to `t.removeAttr(name)`, which clears the
    * attribute from both HSON and DOM according to `LiveTree` semantics.
    *
    * @param name - Attribute name to remove from each selected node.
    * @returns This `TreeSelector` instance, for chaining.
    * @see LiveTree.removeAttr
    */
  removeAttr(name: string): TreeSelector;

  /**
     * Set one or more boolean-present attributes ("flags") on every
     * `LiveTree` in this selector.
     *
     * For each tree, forwards to `t.setFlags(...names)`, so that each named
     * attribute is present and treated as a flag on all selected nodes.
     *
     * @param names - One or more attribute names to set as flags.
     * @returns This `TreeSelector` instance, for chaining.
     * @see LiveTree.setFlags
     */
  setFlags(...names: string[]): TreeSelector;
  /**
    * Set one or more boolean-present attributes ("flags") on every
    * `LiveTree` in this selector.
    *
    * For each tree, forwards to `t.setFlags(...names)`, so that each named
    * attribute is present and treated as a flag on all selected nodes.
    *
    * @param names - One or more attribute names to set as flags.
    * @returns This `TreeSelector` instance, for chaining.
    * @see LiveTree.setFlags
    */
  removeFlags(...names: string[]): TreeSelector;

  /**
     * Multi-node style manager for the current selection.
     *
     * Behavior:
     * - Throws if the selection is empty, since there is no canonical
     *   element to read style state from.
     * - Uses the first `LiveTree` in the selection as the canonical source
     *   of style state and as the base `StyleManager2` surface.
     * - Returns a proxy object that:
     *   - Inherits all methods/props from the first tree's `style`.
     *   - Overrides `setMulti` to broadcast the given style block to all
     *     trees in the selection, while preserving the original return
     *     contract (a `LiveTree` from the first item).
     *
     * Reads behave as if calling `.style` on the first tree; writes via
     * `setMulti` are applied to every selected tree.
     *
     * @returns A `StyleManager2`-compatible proxy for the selection.
     * @see StyleManager
     */
  readonly style: StyleManager;

  /**
   * QUID-scoped stylesheet handle for the current selection.
   *
   * Behavior:
   * - When the selection is empty, returns a safe no-op `CssHandle`
   *   by calling `css_for_quids([])`.
   * - Otherwise, collects `tree.quid` for each `LiveTree` (ignoring
   *   falsy values) and calls `css_for_quids(quids)` to produce a
   *   combined handle for all selected nodes.
   *
   * The resulting handle can be used to manage styles keyed by the
   * QUIDs of all trees in the selection.
   *
   * @returns A `CssHandle` that targets all QUIDs in the selection, or a
   *          no-op handle when empty.
   * @see css_for_quids
   */
  readonly css: CssHandle;
  /**
    * Multi-node dataset manager for the current selection.
    *
    * The returned `DataManager2` facade:
    * - Broadcasts write operations such as `set` and `setMulti` to the
    *   `.data` manager of each tree in `items`, then returns the first
    *   `LiveTree` in the list to preserve `DataManager2`'s chaining model.
    * - Implements read operations such as `get` by querying only the
    *   first tree, treating its dataset as canonical for the selection.
    *
    * When the selection is empty, read and write operations throw in the
    * same way they would if `.data` were accessed on a non-existent
    * `LiveTree`.
    *
    * @returns A `DataManager2` facade that fans operations out to all
    *          selected trees.
    * @see DataManager
    * @see makeMultiDataManager
    */
  readonly data: DataManager;
  /**
     * Multi-node event listener builder for the current selection.
     *
     * Behavior:
     * - When the selection is empty, returns a fully-typed no-op
     *   `ListenerBuilder` where:
     *   - All configuration methods chain and do nothing.
     *   - `attach()` returns a `ListenerSub` with `count = 0`, `ok = false`,
     *     and a no-op `off()`.
     * - When the selection is non-empty:
     *   - Creates one real `ListenerBuilder` per `LiveTree` via
     *     `buildListener(tree)`.
     *   - Returns a composite `ListenerBuilder` whose methods fan out to
     *     each underlying builder and then return the composite for chaining.
     *   - `attach()` aggregates underlying `ListenerSub` objects into a
     *     single `ListenerSub` whose `count` is the sum of all counts and
     *     whose `off()` tears down all underlying subscriptions.
     *
     * This allows identical listener configuration to be applied to all
     * selected nodes through a single fluent API.
     *
     * @returns A `ListenerBuilder` that targets all trees in the selection.
     * @see ListenerBuilder
     * @see build_listener
     * @see makeMultiListener
     */
  readonly listen: ListenerBuilder;
  /**
    * Creation helper for the current selection, providing the same surface
    * API as `LiveTree.create` but broadcasting across all `LiveTree` items
    * and returning a new `TreeSelector` of the created children.
    *
    * Behavior:
    * - Per-tag methods (e.g. `selector.create.div(index?)`):
    *   - For each tree in the selection, call `tree.create.div(index?)`.
    *   - Collect all returned children into a flattened `TreeSelector`.
    * - Batch method (`selector.create.tags([...], index?)`):
    *   - For each tree, call `tree.create.tags([...], index?)`.
    *   - Flatten all created children into a single `TreeSelector`.
    *
    * The original selection is not modified; each `create` call produces
    * a new selection representing only the newly created nodes.
    *
    * @returns A `TreeSelectorCreateHelper` scoped to the current selection.
    * @see TreeSelectorCreateHelper
    * @see LiveTreeCreateHelper
    * @see make_selector_create
    */
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
     * @see LiveTree.setText 
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
 * - Per-tag typed interface (e.g. `tree.create.div(index?)`) returns a `LiveTree`
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
