// live-tree-class.tree.hson.ts

import { STR_TAG } from "../../types-consts/constants";
import { _DATA_QUID } from "../../types-consts/constants";
import { after_paint, append } from "./tree-methods/append.tree";
import { DatasetManager } from "./tree-methods/dataset-manager.tree";
import { empty } from "./tree-methods/empty.tree.utils";
import { get_content } from "./tree-methods/get-content.tree";
import { remove_child } from "./tree-methods/remove-child.tree.utils";
import { drop_quid, ensure_quid, get_node_by_quid } from '../../quid/data-quid.quid'
import { StyleManager } from "./tree-methods/style-manager-2.utils";
import { BasicValue, HsonNode, HsonQuery, Primitive } from "../../types-consts";
import { is_Node } from "../../utils/node-utils/node-guards.new.utils";
import { makeListenerBuilder } from "./tree-methods/listen.tree";
import { ListenerBuilder } from "../../types-consts/listener-builder-types";
import { set_attrs_safe } from "../../safety/safe-mount.safe";
import { make_leaf } from "../parsers/parse-tokens.new.transform";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { detach_node_deep } from "../../utils/tree-utils/detach-node.tree.utils";
import { parse_selector } from "../../utils/tree-utils/parse-selector.utils";
import { getElementForNode } from "../../utils/tree-utils/node-map-helpers.utils";


/**
 * LiveTree
 * --------
 * A chainable, node-centric API for manipulating DOM backed by HSON IR.
 *
 * Fundamental design points:
 *
 * 1. **Selection is always HsonNodes.**
 *    LiveTree never stores raw DOM Elements. Internally it tracks
 *    `selectedNodes: HsonNode[]`.
 *
 * 2. **DOM resolution is done lazily via QUID.**
 *    Real Elements are obtained by looking up each node’s QUID inside
 *    `NODE_ELEMENT_MAP`. This ensures:
 *      - selection remains stable even if the DOM moves,
 *      - no direct Element references leak out of the public API,
 *      - DOM sync is consistent and centralized.
 *
 * 3. **Pure, chainable discovery.**
 *    `find()` and `findAll()` return *new* LiveTree instances with a
 *    derived selection. Mutating methods (`setAttrs`, `remove`,
 *    `setContent`, etc.) modify the Nodes and update mapped DOM.
 *
 * 4. **Nodes-first, DOM-second.**
 *    The HSON Node tree is the source of truth. DOM writes happen
 *    only if the node is currently mounted.
 *
 * 5. **Minimal surface.**
 *    LiveTree aims to expose only the primitives needed for ergonomic
 *    DOM manipulation: selection, attributes, dataset, css facade,
 *    content manipulation, and structural operations like append/remove.
 *
 * In short: LiveTree gives ergonomic DOM manipulation without ever
 * exposing the DOM directly and without losing the formal structure
 * provided by the HSON node IR.
 */

type NodeRef = {
  q: string;
  resolveNode(): HsonNode | undefined;
  resolveElement(): Element | undefined;
};

// finder methods (convert results → refs)
type FindWithById = {
  (q: HsonQuery | string): LiveTree;
  byId(id: string): LiveTree | undefined;
};

interface MultiResult {
  // batch ops
  asBranch(): LiveTree;
  style: LiveTree['style'];                       // ← simple, correct

  // attrs (forward to existing LiveTree methods)
  setAttrs(name: string, value: string | boolean | null): any;
  setAttrs(map: Record<string, string | boolean | null>): any;
  getAttrs(): Record<string, string> | undefined;

  // array-ish
  toArray(): LiveTree[];
  forEach(fn: (node: LiveTree, i: number) => void): void;
  map<T>(fn: (node: LiveTree, i: number) => T): T[];

  // convenience expected by callers
  count(): number;
  at(i: number): LiveTree | undefined;
}

function makeMulti(found: HsonNode[], roots?: HsonNode[]): MultiResult {
  const branch = new LiveTree(found, roots);            // batch target (all)
  const arr = found.map(n => new LiveTree([n], roots)); // single-node wrappers

  function setAttrs(nameOrMap: any, val?: any) {
    // forward to LiveTree.setAttrs
    return (branch as any).setAttrs(nameOrMap, val);
  }

  return {
    asBranch() { return branch; },

    // getter preserves the exact type of LiveTree['style']
    get style() { return branch.style; },

    setAttrs,                                      // overload impl
    getAttrs() { return (branch as any).getAttrs?.(); },

    toArray() { return arr; },
    forEach(fn) { for (let i = 0; i < arr.length; i++) fn(arr[i], i); },
    map(fn) { return arr.map(fn); },

    count() { return arr.length; },
    at(i) { return (i >= 0 && i < arr.length) ? arr[i] : undefined; },
  };
}


function makeRef(n: HsonNode): NodeRef {
  const q = ensure_quid(n); // no persist
  // stamp only if already mounted
  const el0 = getElementForNode(n);
  if (el0) set_attrs_safe(el0, _DATA_QUID, q);

  return {
    q,
    resolveNode: () => get_node_by_quid(q),
    resolveElement: () => {
      const node = get_node_by_quid(q);
      const el = node ? getElementForNode(node) : undefined;
      return el ?? (document.querySelector(`[${_DATA_QUID}="${q}"]`) as HTMLElement | undefined);
    },
  };
}

export class LiveTree {
  private selected: NodeRef[] = [];
  private rootRefs: HsonNode[] = [];
  /*   managers */
  private styleManager: StyleManager | undefined = undefined;
  private datasetManager: DatasetManager | undefined = undefined;
  /**
   * Creates a LiveTree wrapper around a root HSON node.
   *
   * @param root - The root HSON node for this tree.
   * @param selection - Optional explicit selection. If omitted, defaults
   *   to `[root]`.
   *
   * Notes:
   * - The constructor does not create or attach DOM elements. It assumes
   *   the caller has already run `create_live_tree()` or grafted the tree.
   * - DOM lookup is lazy: an Element is retrieved only when needed,
   *   via QUID → NODE_ELEMENT_MAP.
   */
  constructor($nodes?: HsonNode | HsonNode[] | LiveTree, rootHint?: HsonNode | HsonNode[]) {
    this.setRoots($nodes, rootHint);
    this.setSelected($nodes);
  }


  /* nodes view (read-only) */
  private get selectedNodes(): HsonNode[] {
    const out: HsonNode[] = [];
    for (const r of this.selected) {
      const n = r.resolveNode();
      if (n) out.push(n);
    }
    return out;
  }


  private setSelected(input?: HsonNode | HsonNode[] | LiveTree) {
    if (input instanceof LiveTree) {
      this.selected = input.selected.slice(); // copy refs
      input.listen
    } else if (Array.isArray(input)) {
      this.selected = input.filter(is_Node).map(makeRef);
    } else if (input && is_Node(input)) {
      this.selected = [makeRef(input)];
    } else {
      this.selected = [];
    }
  }

  private setRoots(input?: HsonNode | HsonNode[] | LiveTree, hint?: HsonNode | HsonNode[]) {
    if (input instanceof LiveTree) {
      this.rootRefs = input.rootRefs.slice();
      return;
    }

    if (hint) {
      this.rootRefs = Array.isArray(hint) ? hint.filter(is_Node) : [hint];
      return;
    }

    if (Array.isArray(input)) {
      this.rootRefs = input.filter(is_Node);
    } else if (input && is_Node(input)) {
      this.rootRefs = [input];
    } else {
      this.rootRefs = [];
    }
  }

  /* helper to temporarily run legacy logic that expects nodes */
  private withNodes<T>(fn: (nodes: HsonNode[]) => T): T {
    return fn(this.selectedNodes);
  }

  // Remove references to nodes from any known root trees
  private pruneFromRoots(targets: HsonNode[]): void {
    if (!targets.length || !this.rootRefs.length) return;
    const toDrop = new Set(targets);

    const prune = (node: HsonNode): void => {
      const kids = node._content;
      if (!Array.isArray(kids) || kids.length === 0) return;

      node._content = kids.filter(child => {
        if (!is_Node(child)) return true;
        if (toDrop.has(child)) return false;
        prune(child);
        return true;
      });
    };

    for (const root of this.rootRefs) prune(root);
  }

  // internal: allow a branch to inherit host roots when grafted/appended
  adoptRoots(roots: HsonNode[]): this {
    this.rootRefs = roots;
    return this;
  }

  public async afterPaint(): Promise<this> {
    // comment: await a frame boundary without changing call sites that don’t need it
    await after_paint();
    return this;
  }

  /*  Finds the first descendant matching a query  */
  public append = append;
  public empty = empty;
  public removeChild = remove_child;
  public getContent = get_content;
  public getSelectedNodes(): HsonNode[] {
    return this.selectedNodes;  // not a field; calls the getter above
  }

  /**
   * Begins construction of an event-listener descriptor for the current selection.
   *
   * `.listen` returns a builder object that lets you declare:
   *   - event type (`.on('click')`)
   *   - handler function
   *   - options such as `{ prevent, stop, once, capture }`
   *   - attachment strategy (auto-attach or manual)
   *
   * The builder queues listeners until they are attached, and always resolves
   * node references lazily via the LiveTree’s selection model. This ensures that
   * listeners attach to the correct DOM nodes even if the selection changes or
   * the DOM moves before attachment.
   *
   * See `makeListenerBuilder()` for full behavior and edge-case details.
   */
  get listen(): ListenerBuilder {
    return makeListenerBuilder(this);
  }

  /**
   * Provides a StyleManager for the current LiveTree.
   *
   * The manager is lazily created once per LiveTree instance and reused
   * on subsequent calls. It exposes:
   *   - a typed, property-based `set` facade (e.g. `tree.style.set.width(240)`)
   *   - string-based helpers (`setProperty`, `get`, `remove`)
   *   - batch setters (`css`, `cssReplace`)
   *
   * All operations target the current selection and update both:
   *   - the HSON node IR, and
   *   - the mapped DOM elements (when mounted).
   */
  get style(): StyleManager {
    if (!this.styleManager) this.styleManager = new StyleManager(this);
    return this.styleManager;
  }
  /**
   * Provides a DatasetManager bound to this LiveTree.
   *
   * The manager offers a focused API for interacting with `data-*` attributes
   * on the currently-selected nodes. It mirrors the behavior of native
   * `HTMLElement.dataset`, but operates on:
   *   - the underlying HSON node IR, and
   *   - the mapped DOM elements (when mounted).
   *
   * The manager supports:
   *   - `set(key, value)` – assign or remove a `data-*` attribute
   *   - `get(key)` – read `data-*` from the first selected node
   *
   * Keys are expected in *logical* form (e.g. `"userId"`), and are normalized
   * to `data-user-id`. This matches the DOM’s kebab-case convention.
   */
  get dataset(): DatasetManager {
    if (!this.datasetManager) this.datasetManager = new DatasetManager(this);
    return this.datasetManager;
  }

  /**
  * Finds the first descendant matching a query.
  *
  * @param q - Either:
  *   - an HsonQuery object (shape-based match against nodes), or
  *   - a string in HSON's selector syntax, which is parsed via
  *     `parse_selector` (this is not full CSS; it is a smaller,
  *     HSON-specific selector language).
  *
  * @returns A new LiveTree whose selection contains at most one node:
  *   - the first match if found,
  *   - or an empty selection if nothing matches.
  *   - `find.byId(...)` convenience returns `undefined` when not found.
  *
  * Notes:
  * - Matching is done against the HSON node tree, not via DOM
  *   querySelector.
  * - The new LiveTree shares the same root and QUID/DOM mapping; only
  *   `selectedNodes` differs.
  */
  get find(): FindWithById {
    const self = this;

    const base = ((q: HsonQuery | string): LiveTree => {
      const query = typeof q === "string" ? parse_selector(q) : q;
      const found = self.search(self.selectedNodes, query, { findFirst: true });
      return new LiveTree(found, self.rootRefs);
    }) as FindWithById; // localized, internal assertion

    base.byId = (id: string): LiveTree | undefined => {
      const tree = base({ attrs: { id } });
      return tree.count() ? tree : undefined;
    };

    return base;
  }

  /**
 * Finds *all* descendants matching a CSS selector.
 *
 * @param selector - Standard CSS selector.
 * @returns A new LiveTree with zero or more selected nodes.
 *
 * Notes:
 * - Results preserve Node order.
 * - Matching uses the node tree, not live DOM querySelectorAll.
 * - A LiveTree with an empty selection is valid and safe; most mutation
 *   methods become no-ops.
 */
  findAll(q: HsonQuery | string): MultiResult {
    const query = typeof q === 'string' ? parse_selector(q) : q;
    const found = this.search(this.selectedNodes, query, { findFirst: false });

    // if no matches, return an inert wrapper rather than throwing
    if (!found.length) {
      return makeMulti([], this.rootRefs);  // empty branch behaves safely
    }

    return makeMulti(found, this.rootRefs);
  }

  at(index: number): LiveTree {
    const n = this.selectedNodes[index];
    return new LiveTree(n ? [n] : undefined, this.rootRefs);
  }

  /**
   * Sets one or more HTML attributes on the current selection.
   *
   * Overloads:
   *   - `setAttrs(name, value)`:
   *       Set or remove a single attribute.
   *   - `setAttrs(map)`:
   *       Set or remove multiple attributes in one call.
   *
   * Semantics per attribute:
   *   - `value === false` or `value === null`:
   *       → attribute is removed from the node tree and DOM element.
   *
   *   - `value === true` or `value === name`:
   *       → attribute is treated as a boolean *presence* attribute.
   *         In the DOM this is written as `name=""`.
   *         In the IR, the key is removed from `_attrs` to avoid
   *         redundant string storage (presence is implied by DOM).
   *
   *   - any other value:
   *       → converted to string and stored as a normal attribute
   *         (both in `_attrs` and on the DOM element).
   *
   * This method:
   *   - operates on all currently selected nodes,
   *   - updates both the HSON nodes and the mapped DOM element
   *     (when one exists),
   *   - throws if a selected node has no associated DOM element
   *     in the node–element map (this indicates a LiveTree mismatch).
   *
   * @param name - Single attribute name (string form).
   * @param value - Attribute value as string, boolean, or null.
   * @param map - Map of attribute names to values.
   * @returns The same LiveTree instance for chaining.
   */
  setAttrs(name: string, value: string | boolean | null): this;
  setAttrs(map: Record<string, string | boolean | null>): this;
  setAttrs(a: string | Record<string, string | boolean | null>, v?: string | boolean | null): this {
    if (typeof a === "string") {
      return this._setOne(a, v ?? "");
    }
    for (const [k, val] of Object.entries(a)) this._setOne(k, val);
    return this;
  }

  // tiny internal: single-attr write with ns awareness (works for both HTML and SVG)
  private _setOne(name: string, value: string | boolean | null): this {
    this.withNodes(nodes => {
      for (const node of nodes) {
        if (!node._attrs) node._attrs = {};
        const el = getElementForNode(node) as Element | undefined;
        if (!el) _throw_transform_err(`[LiveTree] missing element for node`, 'getElementForNode');

        if (value === false || value === null) {
          delete node._attrs[name];
          el.removeAttribute(name);
          continue;
        }
        if (value === true || value === name) {
          // boolean present attribute
          delete node._attrs[name];
          el.setAttribute(name, "");
          continue;
        }
        const s = String(value);
        node._attrs[name] = s;
        el.setAttribute(name, s);
      }
    });
    return this;
  }

  /**
   * Adds one or more boolean “flag” attributes to all selected nodes.
   *
   * Each flag name is written as a HTML boolean attribute, a single string 
   * (unquoted, spaces not permitted) e.g. 
   * `disabled="disabled"` → `disabled` in the DOM. 
   * 
   * In the Node representation, boolean flags are represented using the same rules as `setAttrs()`:
   *
   *   - `setFlags("foo")` is equivalent to `setAttrs("foo", true)`.
   *   - Flags can be cleared using `setAttrs("foo", false | null)`
   *     or via a separate remove/clear helper.
   *
   * This is a convenience for boolean attributes that act as UI flags:
   *   - `disabled`, `checked`, `readonly`, `hidden`, etc.
   *
   * @param names - One or more attribute names to add as boolean flags.
   * @returns The same LiveTree instance for chaining.
   */
  setFlags(...names: string[]): this {
    for (const name of names) {
      this._setOne(name, name);
    }
    return this;
  }

  /**
 * Removes all selected nodes from the Node tree and from the DOM (if mounted).
 *
 * Behavior:
 * - Removes the HSON node from its parent `_content` array.
 * - Removes the mapped DOM Element via `element.remove()`.
 * - After removal the current LiveTree selection still points to the
 *   nodes that were removed, but further mutations are no-ops.
 *
 * Useful for:
 * - Clearing sections.
 * - Removing dynamically-created elements.
 */
  remove(): this {
    const nodes = this.selectedNodes;
    for (const n of nodes) {
      // tear down subtree: listeners + DOM + map
      detach_node_deep(n);

      // drop quids (if invalid after removal)
      drop_quid(n);
    }

    // prune from data model if we know the roots
    this.pruneFromRoots(nodes);

    // clear selection
    this.selected = [];
    return this;
  }

  /*   action/setter methods   */

  /**
   * sets the 'value' property for form elements like <input> and <textarea>
   *   directly manipulates the .value property of the live DOM element and the 
   *   'value' attribute in the HSON data model.
   *   it does NOT modify the node's content/child nodes
   *
   * @param $value new value
   * @returns current tree instance (for chaining)
   */
  setValue(value: string, opts?: { silent?: boolean }): this {
    for (const node of this.selectedNodes) {
      if (node._tag !== "input" && node._tag !== "textarea") {
        console.warn(
          `setValue() called on a <${node._tag}> element. This method is intended only for <input> and <textarea>.`
        );
        continue;
      }

      const el = getElementForNode(node) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | undefined;

      if (el) {
        const prev = el.value;
        el.value = value;

        // only fire event if the value actually changed and not silent
        if (!opts?.silent && value !== prev) {
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      // sync data model
      if (!node._attrs) node._attrs = {};
      node._attrs.value = value;
    }

    return this;
  }

  /**
 * Replaces the entire contents of the selected nodes.
 *
 * @param content - A string (→ creates a STR/VAL node), an HsonNode,
 *   or an array of nodes.
 *
 * Behavior:
 * - Node children are replaced wholesale.
 * - DOM children are replaced via DOM diffing rules:
 *     - If mounted, old children are removed and new ones appended.
 *     - If unmounted, Node is updated but DOM is untouched.
 *
 * Examples:
 *   tree.find('#msg').setContent("hello");
 *   tree.find('#list').setContent([nodeA, nodeB]);
 */
  setContent(v: Primitive): this {
    for (const node of this.selectedNodes) {
      const leaf = make_leaf(v);
      node._content = [leaf];

      const el = getElementForNode(node);
      if (!el) {
        const quid = node._meta?._quid ?? "<no-quid>";
        _throw_transform_err(
          `missing element for node (tag=${node._tag}, quid=${quid})`,
          "setContent",
        );
      }

      (el as HTMLElement).textContent = v === null ? "" : String(v);
    }
    return this;
  }



  removeAttr($name: string): this {
    return this.setAttrs($name, null);
  }


  /*  -vvv- reader methods -vvv- */

  getAttr($attr: string): Primitive | undefined {
    if (this.selectedNodes.length === 0) return undefined;
    const node = this.selectedNodes[0];
    if (!node?._attrs) return undefined;
    if (node._attrs && $attr in node._attrs) return node._attrs[$attr];
    return undefined;
  }

  getFirstText(): string {
    const n = this.selectedNodes[0];
    if (!n) return '';
    const el = getElementForNode(n);
    if (el) return el.textContent ?? '';          // <-- grabs the full text
    // Fallback to model if not mounted
    const kids = (n._content ?? []).filter(is_Node);
    for (const k of kids) {
      if (k._tag === STR_TAG && typeof k._content?.[0] === 'string') {
        return k._content[0] as string;
      }
    }
    return '';
  }

  count(): number {
    return this.selectedNodes.length;
  }

  getValue(): string {
    if (this.selectedNodes.length === 0) return '';
    const liveElement = getElementForNode(this.selectedNodes[0]);
    return (liveElement as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';
  }

  asDomElement(): Element | undefined {
    const n = this.selectedNodes[0];
    if (!n) {
      console.warn('[asDomElement] no nodes in selection');
      return undefined;
    }

    const el = getElementForNode(n);
    if (!el) {
      console.warn('[asDomElement] element not found for selected node:', n);
      return undefined;
    }

    return el;
  }

  /**
 * Finds the first descendant matching a query.
 *
 * @param q - Either:
 *   - an HsonQuery object (shape-based match against nodes), or
 *   - a string in HSON's selector syntax, which is parsed via
 *     `parse_selector` (this is not full CSS; it is a smaller,
 *     HSON-specific selector language).
 *
 * @returns A new LiveTree whose selection contains at most one node:
 *   - the first match if found,
 *   - or an empty selection if nothing matches.
 *
 * Notes:
 * - Matching is done against the HSON node tree, not via DOM
 *   querySelector.
 * - The new LiveTree shares the same root and QUID/DOM mapping; only
 *   `selectedNodes` differs.
 */
  sourceNode(all = true, index?: number): HsonNode | HsonNode[] | undefined {
    const arr = this.selectedNodes;
    if (arr.length === 0) return undefined;
    return all ? arr : arr[index ?? 0];
  }

  /**
   * helper method to perform the recursive search.
   */
  private search($nodes: HsonNode[], $query: HsonQuery, $options: { findFirst: boolean }): HsonNode[] {
    const results: HsonNode[] = [];

    const matchAttrs = (node: HsonNode): boolean => {
      if (!$query.attrs) return true;
      const na = node._attrs ?? {};
      for (const [k, qv] of Object.entries($query.attrs)) {
        const nv = na[k as keyof typeof na];
        if (qv instanceof RegExp) {
          if (typeof nv !== 'string' || !qv.test(nv)) return false;
        } else if (typeof qv === 'object' && qv !== null) {
          // shallow object compare (e.g., style object); tweak if deep needed
          if (typeof nv !== 'object' || nv === null) return false;
          for (const [sk, sv] of Object.entries(qv as Record<string, unknown>)) {
            if ((nv as any)[sk] !== sv) return false;
          }
        } else if (qv === true) {
          // flag-ish attribute: present is enough
          if (!(k in na)) return false;
        } else {
          if (nv !== qv) return false;
        }
      }
      return true;
    };
    const isRegExp = (v: unknown): v is RegExp =>
      Object.prototype.toString.call(v) === '[object RegExp]';

    const matchMeta = (node: HsonNode): boolean => {
      if (!$query.meta) return true;
      const nm = node._meta ?? {};
      const qMeta = $query.meta as Record<string, unknown>;

      for (const [k, qv] of Object.entries(qMeta)) {
        const nv = (nm as any)[k];
        if (isRegExp(qv)) {
          if (typeof nv !== 'string' || !qv.test(nv)) return false;
        } else if (nv !== qv) {
          return false;
        }
      }
      return true;
    };
    const nodeText = (n: HsonNode): string => {
      // Prefer live text if present; fall back to model (_str children)
      const el = getElementForNode(n);
      if (el) return el.textContent ?? '';
      const kids = (n._content ?? []).filter(is_Node);
      for (const k of kids) {
        if (k._tag === STR_TAG && typeof k._content?.[0] === 'string') {
          return k._content[0] as string;
        }
      }
      return '';
    };

    const matchText = (node: HsonNode): boolean => {
      const q = $query.text;
      if (!q) return true;
      const t = nodeText(node);
      return typeof q === 'string' ? t.includes(q) : q.test(t);
    };

    const checkNode = (node: HsonNode): boolean => {
      const tagOK = !$query.tag || node._tag.toLowerCase() === $query.tag.toLowerCase();
      return tagOK && matchAttrs(node) && matchMeta(node) && matchText(node);
    };

    const traverse = (nodesToSearch: HsonNode[]) => {
      for (const node of nodesToSearch) {
        if ($options.findFirst && results.length) return;
        if (checkNode(node)) results.push(node);
        const kids = (node._content ?? []).filter(is_Node);
        if (kids.length) traverse(kids);
      }
    };

    traverse($nodes);
    return $options.findFirst ? results.slice(0, 1) : results;
  }

}
