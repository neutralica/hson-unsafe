// livetree2.ts

import { ensure_quid, get_node_by_quid } from "../../quid/data-quid.quid";
import { HsonNode } from "../../types-consts/node.types";
import { ListenerBuilder } from "../../types-consts/listen.types";
import { element_for_node } from "../../utils/tree-utils/node-map-helpers";
import { css_for_quids } from "./livetree-methods/css-manager";
import { CssHandle } from "../../types-consts/css.types";
import { remove_self } from "./livetree-methods/remove2";
import { get_node_form_value, get_node_text, set_node_content, set_node_form_value } from "./livetree-methods/content-manager";
import { DataManager } from "./livetree-methods/data-manager";
import { empty_contents } from "./livetree-methods/empty2";
import { build_listener } from "./livetree-methods/listen";
import { FindMany, make_find_all_for, make_find_for } from "./livetree-methods/find"; // CHANGED
import { clearFlagsImpl, getAttrImpl, removeAttrImpl, setAttrsImpl, setFlagsImpl } from "./livetree-methods/attrs-manager";
import { remove_child } from "./livetree-methods/remove-child2";
import { StyleManager } from "./livetree-methods/style-manager";
import { LiveTreeCreateHelper } from "../../types-consts/livetree.types"; // CHANGED
import { append_branch } from "./livetree-methods/append-other";
import { make_tree_create } from "./livetree-methods/create-typed";
import { FindWithById, NodeRef } from "../../types-consts/livetree.types";
import { Primitive } from "../../types-consts/core.types";
import { StyleSetter } from "./livetree-methods/style-setter";
import { make_tree_selector } from "./tree-selector";

/**
 * Create a stable `NodeRef` for a given `HsonNode`.
 *
 * Behavior:
 * - Ensures the node has a QUID via `ensure_quid(node)` and stores it
 *   as `q` on the reference.
 * - Provides `resolveNode()` which currently returns the original
 *   `HsonNode` directly.
 * - Provides `resolveElement()` which returns the associated DOM
 *   `Element`, if any, via `element_for_node(node)`.
 *
 * This is the primary bridge between HSON nodes, their QUID identity,
 * and any DOM elements registered in `NODE_ELEMENT_MAP`.
 *
 * @param node - The HSON node to wrap in a reference.
 * @returns A `NodeRef` that exposes QUID, node, and DOM element lookup.
 * @see ensure_quid
 * @see element_for_node
 */
function makeRef(node: HsonNode): NodeRef {
  /*  Ensure the node has a stable QUID and keeps NODE_ELEMENT_MAP happy. */
  const q = ensure_quid(node);

  const ref: NodeRef = {
    q,
    resolveNode(): HsonNode { /* exposes the node itself */
      // if we later introduce a global QUID→node map,
      // this is where to switch to a lookup.
      return node;
    },

    resolveElement(): Element | undefined { /* exposes the DOM Element . */
      return element_for_node(node) ?? undefined;
    },
  };

  return ref;
}

/**
 * Instrumented rapper around a single `HsonNode` 
 * providing a high-level API for:
 *
 * - Traversal and selection (`find`, `findAll`).
 * - Structural editing (`append`, `empty`, `removeChild`, `remove`).
 * - Attribute and flag management (`setAttrs`, `getAttr`, `setFlags`, …).
 * - Content and form value (`setText`, `getText`, `setFormValue`, …).
 * - Style, dataset, CSS, and event management (`style`, `data`, `css`,
 *   `listen`).
 * - Typed element creation via `.create`.
 *
 * Instances maintain:
 * - nodeRef: A NodeRefthat pins the current node and QUID.
 * - hostRoot: HSON node representing the original or current root of
 *   the subtree.
 * - Lazily constructed managers for style (`StyleManager2`) and
 *   dataset (`DataManager2`).
 *
 * All mutating operations update the underlying HSON tree and, where
 * applicable, the live DOM, while returning the same `LiveTree` to
 * enable fluent chaining.
 */
export class LiveTree {
  /*---------- the HsonNode being referenced */
  private nodeRef!: NodeRef;
  /*---------- the root node or historic root node */
  private hostRoot!: HsonNode;
  /*---------- inline style editor */
  private styleManagerInternal: StyleManager | undefined = undefined;
  /*---------- .dataset editor */
  private datasetManagerInternal: DataManager | undefined = undefined;
  /**
   * Internal helper to assign `nodeRef` from either a raw `HsonNode`
   * or another `LiveTree`.
   *
   * Behavior:
   * - When given a `LiveTree`, re-wraps its `.node` in a fresh `NodeRef`
   *   to ensure a stable QUID and consistent `resolve*` behavior.
   * - When given a `HsonNode`, wraps it directly via `makeRef`.
   *
   * This method centralizes creation of the `NodeRef` used by the
   * `node` getter and QUID-based DOM resolution.
   *
   * @param input - Either a `HsonNode` or another `LiveTree`.
   * @see makeRef
   */
  private setRef(input: HsonNode | LiveTree): void {
    if (input instanceof LiveTree) {
      this.nodeRef = makeRef(input.node);
      return;
    }
    this.nodeRef = makeRef(input);
  }
  /**
   * Internal helper to assign the `hostRoot` for this `LiveTree`.
   *
   * Behavior:
   * - When given a `LiveTree`, inherits its `hostRoot` so that branches
   *   grafted from an existing tree carry forward the same historic root.
   * - When given a `HsonNode`, treats that node as the root for this
   *   instance.
   *
   * Throws if the resulting `hostRoot` is falsy, as a missing root would
   * break features that depend on a stable root context.
   *
   * @param input - Either a `HsonNode` or another `LiveTree`.
   */
  private setRoot(input: HsonNode | LiveTree): void {
    if (input instanceof LiveTree) {
      this.hostRoot = input.hostRoot;
      if (!this.hostRoot) { throw new Error('could not set host root'); }
      return;
    }
    this.hostRoot = input; /* HsonNode fallback */
    if (!this.hostRoot) { throw new Error('could not set host root'); }
  }
  /**
   * Construct a new `LiveTree` from either a raw `HsonNode` or another
   * `LiveTree`.
   *
   * Initialization steps:
   * - Derive and store the `hostRoot` via `setRoot(input)`.
   * - Create a `NodeRef` and QUID association via `setRef(input)`.
   *
   * When constructed from another `LiveTree`, both the root and the
   * referenced node are inherited so the new instance views the same
   * subtree within the same root context.
   *
   * @param input - A `HsonNode` to wrap, or another `LiveTree` to clone
   *                references from.
   */
  constructor(input: HsonNode | LiveTree) {
    this.setRoot(input);
    this.setRef(input);
  }

  /**
   * Append another `LiveTree` as a child branch of this tree.
   *
   * Delegates to `appendBranch`, which:
   * - Unwraps any `_elem` wrapper on the source branch root.
   * - Appends the resulting nodes under this tree's node in both HSON
   *   and DOM.
   * - Re-roots the appended branch so that it inherits this tree's
   *   `hostRoot` for future operations.
   *
   * @param branch - The branch to append under this tree.
   * @param index - Optional insertion index relative to existing children.
   * @returns This `LiveTree` instance, for chaining.
   * @see append_branch
   */
  public append = append_branch;

  /**
   * Remove all child content under this tree's node.
   *
   * Delegates to `empty2`, which clears both the HSON `_content` and any
   * corresponding DOM nodes for the subtree.
   *
   * @returns This `LiveTree` instance, for chaining.
   * @see empty_contents
   */
  public empty = empty_contents;

  /**
 * Remove a single child subtree from this tree's node.
 *
 * Delegates to `remove_child2`, which locates and removes the targeted
 * child in HSON and DOM according to the underlying implementation.
 *
 * @param q - A query identifying the child to remove (selector, quid, etc.).
 * @returns This `LiveTree` instance, for chaining.
 * @see remove_child
 */
  public removeChild = remove_child;

  /**
 * Remove this `LiveTree`'s node from its parent, disconnecting the
 * subtree from both HSON and DOM.
 *
 * Delegates to `remove2`, which ensures the node and its descendants
 * are detached according to the underlying graph rules.
 *
 * @returns This `LiveTree` instance, for chaining.
 * @see remove_self
 */
  public remove = remove_self;

  /**
   * Find a single descendant subtree relative to this tree.
   *
   * This property is initialized via `makeFindFor(this)` and typically
   * provides a fluent API such as:
   * - `tree.find(query)` → `LiveTree | undefined`
   * - `tree.find.byId(id)` → `LiveTree | undefined`
   * - `tree.find.must(query)` → `LiveTree` or throws
   *
   * Exact query semantics are defined by `makeFindFor`, but this method
   * always scopes searches to the subtree rooted at this `LiveTree`.
   *
   * @see make_find_for
   */
  public find: FindWithById = make_find_for(this);

  /**
   * Find all descendant subtrees matching a query, relative to this tree.
   *
   * Delegates to `findAllFor(this, q)`, which traverses the subtree and
   * returns a `TreeSelector` containing all matching `LiveTree` instances.
   *
   * @param q - A structured `HsonQuery` or string query used to match nodes.
   * @returns A `TreeSelector` over all matching subtrees.
   * @see find_all_in_tree
   */
  public findAll: FindMany = make_find_all_for(this); 

  /**
   * Typed element creation helper bound to this `LiveTree`.
   *
   * Provides sugar such as:
   * - `tree.create.div(index?)` → create a `<div>` child and return a
   *   `LiveTree` for the new element.
   * - `tree.create.tags(["div","span"], index?)` → create multiple
   *   children and return a `TreeSelector` over the new nodes.
   *
   * All elements are created as children of this tree's node using the
   * canonical HTML → HSON pipeline, and any `_elem` wrappers are
   * unwrapped so that the handles point at real elements.
   *
   * @returns A `LiveTreeCreateHelper` scoped to this tree.
   * @see LiveTreeCreateHelper
   * @see make_tree_create
   */
  public get create(): LiveTreeCreateHelper {
    return make_tree_create(this);
  }

  /**
   * Return this tree's QUID, a stable identity string associated with the
   * underlying `HsonNode`.
   *
   * QUIDs are used to:
   * - Track node identity across transforms.
   * - Key CSS and other managers (`css`, `css_for_quids`, etc.).
   *
   * @returns The QUID string for this tree's node.
   * @see makeRef
   */
  public get quid(): string {
    return this.nodeRef.q;
  }

  /**
   * Return the historic root node associated with this `LiveTree`.
   *
   * The host root represents the top-level HSON node for the tree this
   * instance belongs to, even if the current node is a nested descendant.
   *
   * @returns The root `HsonNode` for this tree's context.
   */
  public getHostRoots(): HsonNode {
    return this.hostRoot;
  }

  /* internal: allow a branch to inherit host roots when grafted/appended */
  adoptRoots(root: HsonNode): this {
    this.hostRoot = root;
    return this;
  }
  /**
   * Resolve and return the underlying `HsonNode` for this tree.
   *
   * Delegates to `nodeRef.resolveNode()` and throws if the reference
   * fails to resolve, as this indicates a broken or stale link between
   * the tree and its node.
   *
   * @returns The `HsonNode` currently referenced by this `LiveTree`.
   * @throws If `resolveNode()` returns a falsy value.
   * @see NodeRef.resolveNode
   */
  public get node(): HsonNode {
    const n = this.nodeRef.resolveNode();
    if (!n) {
      throw new Error("LiveTree2.node: ref did not resolve");
    }
    return n;
  }

  /*---------- managers & adapters ---------- */
  /**
  * Style write surface for this node’s **inline** `style=""`.
  *
  * Returns a `StyleSetter` (fluent API) whose backend is this node’s `StyleManager`.
  * The setter:
  * - normalizes property keys (camelCase / kebab-case / `--vars`) into canonical CSS keys,
  * - coerces values to strings (with `null|undefined` meaning “remove”),
  * - applies mutations to inline style while keeping the DOM and HSON attrs in sync.
  *
  * Implementation note:
  * - The underlying `StyleManager` is constructed lazily on first access and cached.
  *
  * @returns A `StyleSetter` bound to this tree’s node (inline style backend).
  * @see make_style_setter
  * @see StyleManager
  */
  public get style(): StyleSetter {
    if (!this.styleManagerInternal) {
      this.styleManagerInternal = new StyleManager(this);
    }
    // StyleManager must expose its StyleSetter (suggested name: `setter`)
    return this.styleManagerInternal.setter;
  }

  /**
   * Lazily constructed dataset manager for this tree's node.
   *
   * Behavior:
   * - On first access, constructs a new `DataManager2` bound to this
   *   `LiveTree` and caches it in `datasetManagerInternal`.
   * - Subsequent accesses return the same manager instance.
   *
   * The data manager provides a structured interface over the node's
   * dataset/attributes (e.g., `data-*` fields), keeping HSON and DOM in
   * sync as needed.
   *
   * @returns A `DataManager2` instance bound to this tree.
   * @see DataManager2
   */
  public get data(): DataManager {
    if (!this.datasetManagerInternal) {
      this.datasetManagerInternal = new DataManager(this);
    }
    return this.datasetManagerInternal;
  }

  /**
   * Style write surface for this node’s stylesheet rule(s), data-_quid as the selector.
   *
   * Returns a `CssHandle` whose core mutation API is a `StyleSetter` backed by `CssManager`.
   * Writes become QUID-scoped blocks of the form:
   *   `[data-_quid="..."] { ... }`
   *
   * This is distinct from `style`:
   * - `style` mutates inline `style=""` on the element,
   * - `css` mutates stylesheet rules owned by `CssManager`.
   *
   * @returns A `CssHandle` targeting this node’s QUID selector.
   * @see css_for_quids
   * @see CssManager
   */
  public get css(): CssHandle {
    return css_for_quids([this.quid]);
  }

  /**
   * Build an event listener configuration helper bound to this tree.
   *
   * Delegates to `buildListener(this)`, which exposes a fluent API for
   * attaching DOM event listeners to the underlying element:
   * - `tree.listen.on("click", handler).attach()`
   * - `tree.listen.onClick(handler).once().attach()`
   *
   * @returns A `ListenerBuilder` bound to this tree's DOM element.
   * @see buildListener
   * @see ListenerBuilder
   */
  public get listen(): ListenerBuilder {
    return build_listener(this);
  }

  /* ---------- attribute / flags API ---------- */
  /**
   * Read a single attribute from this tree's node.
   *
   * Delegates to `getAttrImpl(this, name)`, which treats the HSON node
   * as the source of truth and applies any special handling (e.g. for
   * `style` attributes).
   *
   * @param name - The attribute name to read.
   * @returns The attribute value as a primitive, or `undefined` if absent.
   * @see getAttrImpl
   */
  public getAttr(name: string): Primitive | undefined {
    return getAttrImpl(this, name);
  }
  /**
   * Remove a single attribute from this tree's node.
   *
   * Delegates to `removeAttrImpl(this, name)`, which updates the HSON
   * node and DOM element consistently.
   *
   * @param name - The attribute name to remove.
   * @returns This `LiveTree` instance, for chaining.
   * @see removeAttrImpl
   */
  public removeAttr(name: string): LiveTree {
    return removeAttrImpl(this, name);
  }
  /**
   * Set one or more boolean-present attributes ("flags") on this node.
   *
   * Delegates to `setFlagsImpl(this, ...names)`, which ensures each
   * named attribute is present and treated as a flag, typically by
   * storing `key="key"` or an equivalent representation.
   *
   * @param names - One or more attribute names to set as flags.
   * @returns This `LiveTree` instance, for chaining.
   * @see setFlagsImpl
   */
  public setFlags(...names: string[]): LiveTree {
    return setFlagsImpl(this, ...names);
  }
  /**
   * Clear one or more boolean-present attributes ("flags") on this node.
   *
   * Delegates to `clearFlagsImpl(this, ...names)`, removing each named
   * flag from both HSON and DOM.
   *
   * @param names - One or more attribute names to remove.
   * @returns This `LiveTree` instance, for chaining.
   * @see clearFlagsImpl
   */
  public removeFlags(...names: string[]): LiveTree {
    return clearFlagsImpl(this, ...names);
  }

  /**
   * Set one or more attributes on this node.
   *
   * Overloads:
   * - `setAttrs(name, value)`:
   *   - Set a single attribute by name, where `value` may be a string,
   *     boolean, or `null`.
   * - `setAttrs(map)`:
   *   - Set multiple attributes from a record of names to values.
   *
   * Both forms delegate to `setAttrsImpl(this, nameOrMap, value)`, which
   * normalizes semantics such as:
   * - Removing attributes when given `null`/`false`.
   * - Handling boolean-present attributes.
   * - Special-casing `style` to use structured style objects.
   *
   * @param nameOrMap - Attribute name or map of attribute names to values.
   * @param value - Optional value when setting a single attribute.
   * @returns This `LiveTree` instance, for chaining.
   * @see setAttrsImpl
   */
  public setAttrs(name: string, value: string | boolean | null): LiveTree;
  public setAttrs(map: Record<string, string | boolean | null>): LiveTree;
  public setAttrs(
    nameOrMap: string | Record<string, string | boolean | null>,
    value?: string | boolean | null,
  ): LiveTree {
    return setAttrsImpl(this, nameOrMap, value);
  }

  /*  ---------- content API ---------- */
  /**
   * Replace this tree's node content with a single text/leaf value and
   * mirror that into the associated DOM element's `textContent`.
   *
   * Behavior:
   * - Delegates to `setNodeContent(node, value)`, which:
   *   - Creates a leaf via `make_leaf(value)` and replaces `node._content`
   *     with a single-element array containing that leaf.
   *   - Looks up the mapped DOM element via `element_for_node(node)` and:
   *     - Throws a transform error if no element is found.
   *     - Sets `textContent` to `""` when `value === null`, otherwise to
   *       `String(value)`.
   *
   * This method is a mutating operation: it updates the underlying HSON
   * tree and DOM in place, then returns the same `LiveTree` instance to
   * allow fluent chaining.
   *
   * @param value - The primitive value to render as text for this node.
   * @returns This `LiveTree` instance, for chaining.
   */
  public setText(value: Primitive): LiveTree {
    set_node_content(this.node, value);
    return this;
  }
  /**
 * Return all text content rendered under this tree's node.
 *
 * Delegates to `getNodeText(this.node)`, which:
 * - Prefers the DOM's `textContent` when the node is mounted.
 * - Falls back to a depth-first walk over HSON `_content`, collecting
 *   `_str` nodes when no DOM element is available.
 *
 * @returns A string containing the concatenated text content.
 * @see getNodeText
 */
  public getText(): string {
    return get_node_text(this.node);
  }
  /**
   * Set the "form value" for this node and its associated DOM element.
   *
   * Behavior:
   * - Writes the provided `value` into `node._attrs.value`.
   * - Looks up the DOM element via `element_for_node(node)` and, if it
   *   is an `<input>`, `<textarea>`, or `<select>`, assigns its `.value`.
   * - If no element is found and `opts?.silent` is not true, throws a
   *   transform error.
   *
   * Delegates to `setNodeFormValue(this.node, value, opts)` for the
   * underlying mechanics.
   *
   * @param value - The string form value to apply.
   * @param opts - Optional flags, e.g. `{ silent: true }` to suppress
   *               errors when no DOM element is present.
   * @returns This `LiveTree` instance, for chaining.
   * @see setNodeFormValue
   */
  public setFormValue(value: string, opts?: { silent?: boolean }): LiveTree {
    set_node_form_value(this.node, value, opts);
    return this;
  }
  /**
   * Read the "form value" for this node.
   *
   * Behavior:
   * - If a mounted DOM element exists and is an `<input>`, `<textarea>`,
   *   or `<select>`, returns its `.value`.
   * - Otherwise, falls back to `node._attrs.value` if present.
   * - Returns an empty string when no value is found.
   *
   * Delegates to `getNodeFormValue(this.node)` for the underlying logic.
   *
   * @returns The current form value as a string (possibly empty).
   * @see getNodeFormValue
   */
  public getFormValue(): string {
    return get_node_form_value(this.node);
  }

  /*  ---------- DOM adapter ---------- */
  /**
   * Resolve this tree's node to its associated DOM `Element`, if any.
   *
   * Uses the stored `NodeRef` to call `resolveElement()` and returns
   * the result. If the node has no mapped element, `undefined` is
   * returned instead of throwing.
   *
   * @returns The DOM `Element` corresponding to this tree's node, or
   *          `undefined` if not mounted.
   * @see NodeRef.resolveElement
   */
  // TODO should this return an HtmlElement to prevent constant typeof checks?
  public asDomElement(): Element | undefined {
    const firstRef = this.nodeRef;
    if (!firstRef) return undefined;
    return firstRef.resolveElement();
  }
}
