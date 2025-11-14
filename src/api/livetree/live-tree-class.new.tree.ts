// live-tree-class.tree.hson.ts

import { STR_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { NODE_ELEMENT_MAP } from "../../types-consts/constants";
import { _DATA_QUID } from "../../types-consts/constants";
import { after_paint, append } from "./tree-methods/append.new.tree";
import { DatasetManager } from "./tree-methods/dataset-manager.new.tree";
import { empty } from "./tree-methods/empty.tree.new.utils";
import { get_content } from "./tree-methods/get-content.new.tree";
import { remove_child } from "./tree-methods/remove-child.tree.new.utils";
// import StyleManager_NEW from "./tree-methods/style-manager.new.utils";
import { drop_quid, ensure_quid, get_node_by_quid } from '../../quid/data-quid.quid'
import { StyleManager } from "./tree-methods/style-manager-2.utils";
import { BasicValue, HsonNode, HsonQuery, Primitive } from "../../types-consts";
import { is_Node } from "../../utils/node-utils/node-guards.new.utils";
import { ListenerBuilder, makeListenerBuilder } from "./tree-methods/listen.tree";
import { set_attrs_safe } from "../../safety/safe-mount.safe";
import { make_leaf } from "../parsers/parse-tokens.new.transform";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { detach_node_deep } from "../../utils/tree-utils/detach-node.tree.utils";
import { parse_selector } from "../../utils/tree-utils/parse-selector.utils";




type NodeRef = {
  q: string;
  resolveNode(): HsonNode | undefined;
  resolveEl(): Element | undefined;
};

// finder methods (convert results → refs)
type FindWithById = {
  (q: HsonQuery | string): LiveTree;
  byId(id: string): LiveTree;
};

interface MultiResult {
  // batch ops
  asBranch(): LiveTree;
  style: LiveTree['style'];                       // ← simple, correct

  // attrs (forward to your existing LiveTree methods)
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

function makeMulti(found: HsonNode[]): MultiResult {
  const branch = new LiveTree(found);            // batch target (all)
  const arr = found.map(n => new LiveTree([n])); // single-node wrappers

  function setAttrs(nameOrMap: any, val?: any) {
    // forward to your existing LiveTree.setAttrs
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
  const el0 = NODE_ELEMENT_MAP.get(n);
  if (el0) set_attrs_safe(el0, _DATA_QUID, q);

  return {
    q,
    resolveNode: () => get_node_by_quid(q),
    resolveEl: () => {
      const node = get_node_by_quid(q);
      const el = node ? NODE_ELEMENT_MAP.get(node) : undefined;
      return el ?? (document.querySelector(`[${_DATA_QUID}="${q}"]`) as HTMLElement | undefined);
    },
  };
}

export class LiveTree {
  private selected: NodeRef[] = [];
  // (unchanged) managers…
  private styleManager: StyleManager | undefined = undefined;
  private datasetManager: DatasetManager | undefined = undefined;

  // nodes view (read-only)
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
  // CHANGED: helper to temporarily run legacy logic that expects nodes
  private withNodes<T>(fn: (nodes: HsonNode[]) => T): T {
    return fn(this.selectedNodes);
  }
  public async afterPaint(): Promise<this> {
    // comment: await a frame boundary without changing call sites that don’t need it
    await after_paint();
    return this;
  }
  public append = append
  public empty = empty;
  public removeChild = remove_child;
  public getContent = get_content;
  public getSelectedNodes(): HsonNode[] {
    return this.selectedNodes;  // not a field; calls the getter above
  }

  get listen(): ListenerBuilder {
    return makeListenerBuilder(this);
  }
  // CHANGED: constructor converts inputs → refs
  constructor($nodes?: HsonNode | HsonNode[] | LiveTree) {
    this.setSelected($nodes);
  }

  get style(): StyleManager {
    if (!this.styleManager) this.styleManager = new StyleManager(this);
    return this.styleManager;
  }

  get dataset(): DatasetManager {
    if (!this.datasetManager) this.datasetManager = new DatasetManager(this);
    return this.datasetManager;
  }


  get find(): FindWithById {
    const self = this;

    const base = ((q: HsonQuery | string): LiveTree => {
      const query = typeof q === "string" ? parse_selector(q) : q;
      const found = self.search(self.selectedNodes, query, { findFirst: true });
      return new LiveTree(found);
    }) as FindWithById; // localized, internal assertion

    base.byId = (id: string): LiveTree => base({ attrs: { id } });

    return base;
  }
  findAll(q: HsonQuery | string): MultiResult {
    const query = typeof q === 'string' ? parse_selector(q) : q;
    const found = this.search(this.selectedNodes, query, { findFirst: false });

    // if no matches, return an inert wrapper rather than throwing
    if (!found.length) {
      return makeMulti([]);  // empty branch behaves safely
    }

    return makeMulti(found);
  }

  at(index: number): LiveTree {
    const n = this.selectedNodes[index];
    return new LiveTree(n ? [n] : undefined);
  }

  // === legacy mutators/readers: wrap for now ===

  setAttrs(name: string, value: string | boolean | null): this;
  setAttrs(map: Record<string, string | boolean | null>): this;

  // impl
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
        const el = NODE_ELEMENT_MAP.get(node) as Element | undefined;
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

  remove(): this {
    for (const r of this.selected) {
      const n = r.resolveNode();
      if (!n) continue;

      // tear down subtree: listeners + DOM + map
      detach_node_deep(n);

      // optional: drop quids if you consider them invalid after removal
      drop_quid(n);
    }
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

      const el = NODE_ELEMENT_MAP.get(node) as
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


  setContent(v: Primitive): this {
    for (const node of this.selectedNodes) {
      const leaf = make_leaf(v);
      node._content = [leaf];
      const el = NODE_ELEMENT_MAP.get(node);
      if (!el) _throw_transform_err(`missing element for node ${ensure_quid(node)}`, 'setContent');
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
    const el = NODE_ELEMENT_MAP.get(n);
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
    const liveElement = NODE_ELEMENT_MAP.get(this.selectedNodes[0]);
    return (liveElement as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';
  }

  /**
   * Returns the raw HsonNode(s) for debugging.
   * @param all - If true, returns the entire array of selected nodes. Otherwise, returns the first.
   */
  public getElementFor(node: HsonNode): Element | undefined {
    return NODE_ELEMENT_MAP.get(node)
      ?? (() => {
        const q = ensure_quid(node); // safe: generates if missing
        const el = document.querySelector(`[data-_quid="${q}"]`) as Element | null;
        return el ?? undefined; // ← normalize null → undefined
      })();
  }


  asDomElement(): Element | undefined {
    const n = this.selectedNodes[0];
    if (!n) {
      console.warn('[asDomElement] no nodes found in .selected');
      return undefined;
    }
    const el = this.getElementFor(n);
    if (!el) {
      console.warn('[asDomElement] element not found for _quid:', n._meta?.['data-_quid']);
    }
    return el;
  }

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
          // shallow object compare (e.g., style object); tweak if you need deep
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
      const el = NODE_ELEMENT_MAP.get(n);
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


  // ensure each selected node has a quid, and ensure DOM attribute exists if mounted
  private map_quid(): void {
    for (const n of this.selectedNodes) {
      // ensure in-memory quid (no persistence)
      const q = ensure_quid(n /* default persist:false */);
      // if this node is mounted, stamp DOM attribute for stable lookup
      const el = NODE_ELEMENT_MAP.get(n);
      if (el) set_attrs_safe(el, _DATA_QUID, q);
    }
  }

  // remove DOM attribute for the selected nodes (does not remove in-memory mapping)
  // use when detaching/removing from DOM to avoid orphan attributes
  private unmap_quid(): void {
    for (const n of this.selectedNodes) {
      const el = NODE_ELEMENT_MAP.get(n);
      if (el) el.removeAttribute(_DATA_QUID);
    }
  }

}

