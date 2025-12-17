// livetree2.types.ts

import { LiveTree } from "../api/livetree/livetree";
import { CssHandle } from "./css.types";
import { DataManager } from "../api/livetree/livetree-methods/data-manager";
import { StyleManager } from "../api/livetree/livetree-methods/style-manager";
import { ListenerBuilder } from "./listen.types";
import { HsonAttrs, HsonMeta, HsonNode } from "./node.types";
import { HtmlTag } from "../api/livetree/livetree-methods/create-typed";
import { Primitive } from "./core.types";
import { StyleSetter } from "../api/livetree/livetree-methods/style-setter";

/**************************************************************
 * Structural query for selecting `HsonNode` instances.
 *
 * Each field is optional; all specified predicates must match:
 *
 *   - `tag`   → exact tag name match (`_obj`, `div`, etc.).
 *   - `attrs` → shallow partial match on `_attrs`, using plain
 *               `===` equality for values.
 *   - `meta`  → shallow partial match on `_meta` keys/values.
 *   - `text`  → matches string payload under `_str`/`_val` or
 *               element text:
 *                 • string → substring match,
 *                 • RegExp → `regex.test(...)`.
 *
 * Query objects are consumed by utilities such as `search_nodes`
 * and `LiveTree.find`, which treat missing fields as wildcards.
 **************************************************************/
export interface HsonQuery {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  meta?: Partial<HsonMeta>;
  text?: string | RegExp;
}

/**************************************************************
 * Stable reference to a logical node, keyed by its QUID.
 *
 * A `NodeRef` carries:
 *   - `q`              → the QUID string identifier,
 *   - `resolveNode()`  → lookup in the QUID→node registry,
 *   - `resolveElement()` → lookup the mounted DOM element,
 *                          typically via `NODE_ELEMENT_MAP`.
 *
 * Both resolve methods may return `undefined` if the node has
 * not been materialized, has been detached, or the QUID map was
 * cleared. Callers must treat this as a soft reference.
 **************************************************************/
export interface NodeRef {
  q: string;                       
  resolveNode(): HsonNode | undefined;
  resolveElement(): Element | undefined;
}

/**************************************************************
 * Callable finder bound to a particular `LiveTree` root.
 *
 * Call forms:
 *   - `find(q)`:
 *       • `q: string`     → parsed as a selector-like query,
 *       • `q: HsonQuery`  → structural query object.
 *     Returns a child `LiveTree` for the first match, or
 *     `undefined` on no match.
 *
 *   - `find.byId(id)`:
 *       Shortcut for `{ attrs: { id } }`, limited to the bound
 *       root’s subtree.
 *
 *   - `find.must(q, label?)` / `mustById(id, label?)`:
 *       Same as above, but throws a descriptive `Error` when no
 *       match is found. The optional `label` is used to improve
 *       error messages (e.g. test helpers).
 *
 * Implementations typically:
 *   - run `search_nodes` starting from `tree.node`,
 *   - wrap found `HsonNode` instances via a child `LiveTree`
 *     constructor (`wrapInChildTree`),
 *   - maintain the host root identity across branches.
 **************************************************************/
export interface FindWithById {
  (q: HsonQuery | string): LiveTree | undefined;
  byId(id: string): LiveTree | undefined;
  must(q: HsonQuery | string, label?: string): LiveTree;
  mustById(id: string, label?: string): LiveTree;
}

/**************************************************************
 * Allowed HTML tag names for creation helpers.
 *
 * This is the DOM lib’s `keyof HTMLElementTagNameMap`, ensuring
 * that:
 *   - creation helpers (`create.div`, `create.span`, etc.) only
 *     expose real HTML tag names, and
 *   - type inference for tag-specific element types stays aligned
 *     with the browser’s built-in element map.
 **************************************************************/
export type TagName = keyof HTMLElementTagNameMap;

/**************************************************************
 * Multi-node selection wrapper over an array of `LiveTree`.
 *
 * A `TreeSelector` provides:
 *   - read access to the selected trees (`toArray`, `count`,
 *     `at`, `map`, `forEach`),
 *   - broadcast mutating operations (`setAttrs`, `setFlags`,
 *     `setText`, etc.),
 *   - multi-node facades for style, dataset, and listeners
 *     (`style`, `css`, `data`, `listen`),
 *   - multi-node creation helper (`create`) that builds new
 *     children under each selected tree and returns a new
 *     selector for those children.
 *
 * All mutating methods *return the same selector* to support
 * fluent chaining, while write operations are fanned out to
 * each underlying `LiveTree` in the current selection.
 **************************************************************/
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
  readonly style: StyleSetter;

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

/**************************************************************
 * Generic element-creation helper used to define:
 *   - `LiveTreeCreateHelper`  (single-tree context),
 *   - `TreeSelectorCreateHelper` (multi-tree context).
 *
 * Shape:
 *   - Per-tag methods:
 *       • `.create.div(index?) → Single`
 *         where `Single` is `LiveTree` or `TreeSelector`.
 *   - Batch method:
 *       • `.create.tags([...], index?) → Many`
 *         where `Many` is `TreeSelector` for both cases.
 *
 * Implementations are expected to:
 *   - allocate new HSON nodes for each requested tag,
 *   - keep them *unattached* until the caller explicitly
 *     appends them (e.g. via `.append`),
 *   - propagate the correct `Single` / `Many` return type
 *     according to the context (`tree` vs `selector`).
 **************************************************************/
export type CreateHelper<Single, Many> = {
  // per-tag sugar: .create.div(index?)
  [K in HtmlTag]: (index?: number) => Single;
} & {
  // batch: .create.tags(["div", "span"], index?)
  tags(tags: TagName[], index?: number): Many;
};

/**************************************************************
 * LiveTreeCreateHelper
 *
 * Fluent factory for creating *appended* children relative to
 * a specific parent LiveTree.
 *
 * Semantics (mounted parent):
 * - `tree.create.div(index?)`:
 *     - Parses `<div></div>` into HSON.
 *     - Inserts the new node into `tree.node`'s `_content` at
 *       the given index (or at the end if omitted).
 *     - If `tree` is mounted, creates and inserts the matching
 *       DOM element into the live subtree.
 *     - Returns a `LiveTree` bound to the newly inserted child.
 *
 * Semantics (unmounted parent):
 * - Same HSON insertion contract, but no DOM element exists
 *   until the subtree is grafted into a mounted tree.
 *
 * This makes calls like:
 *
 *   tree.find.mustById("root")
 *     .create.p(1)
 *     .setAttrs({ class: "insert" })
 *     .setText("between");
 *
 * read as “insert a new <p> in the middle and then configure it”.
 **************************************************************/
export type LiveTreeCreateHelper = CreateHelper<LiveTree, TreeSelector>;

/**************************************************************
 * Creation helper exposed as `selector.create` on a
 * `TreeSelector`.
 *
 * Behavior:
 *   - Per-tag calls (e.g. `selector.create.div(index?)`) create
 *     one new child per `LiveTree` in the selection and return a
 *     `TreeSelector` containing all newly created children.
 *
 *   - Batch calls (`selector.create.tags([...], index?)`)
 *     create multiple children under each selected tree, flatten
 *     all of them, and return a single `TreeSelector` over the
 *     entire set.
 *
 * This allows a multi-selection to construct mirrored subtree
 * structures across many parents in a single operation, while
 * keeping the return type consistently `TreeSelector` for
 * further broadcast-style operations.
 **************************************************************/
export type TreeSelectorCreateHelper = CreateHelper<TreeSelector, TreeSelector>;
