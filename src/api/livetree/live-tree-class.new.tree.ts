// live-tree-class.tree.hson.ts

import { STR_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { NODE_ELEMENT_MAP } from "../../types-consts/constants";
import { _DATA_QUID } from "../../types-consts/constants";
import { append_NEW } from "./tree-methods/append.new.tree";
import { DatasetManager } from "./tree-methods/dataset-manager.new.tree";
import { empty_NEW } from "./tree-methods/empty.tree.new.utils";
import { getContent_NEW } from "./tree-methods/get-content.new.tree";
import { removeChild_NEW } from "./tree-methods/remove-child.tree.new.utils";
// import StyleManager_NEW from "./tree-methods/style-manager.new.utils";
import { parseSelector_NEW } from "./tree-utils/parse-selector.utils";
import { ensure_quid, get_node_by_quid } from '../../quid/data-quid.quid'
import { StyleManager2 } from "./tree-methods/style-manager-2.utils";
import { HsonNode, HsonQuery, Primitive } from "../../types-consts";
import { is_Node } from "../../utils/node-guards.new.utils";


type NodeRef = {
  q: string;
  resolveNode(): HsonNode | undefined;
  resolveEl(): HTMLElement | undefined;
};

function makeRef(n: HsonNode): NodeRef {
  const q = ensure_quid(n); // no persist
  // stamp only if already mounted
  const el0 = NODE_ELEMENT_MAP.get(n);
  if (el0) el0.setAttribute(_DATA_QUID, q);

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
  private styleManager: StyleManager2 | undefined = undefined;
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
  public append = append_NEW
  public empty = empty_NEW;
  public removeChild = removeChild_NEW;
  public getContent = getContent_NEW;
  public getSelectedNodes(): HsonNode[] {
    return this.selectedNodes;  // not a field; calls the getter above
  }

  // CHANGED: constructor converts inputs → refs
  constructor($nodes?: HsonNode | HsonNode[] | LiveTree) {
    this.setSelected($nodes);
  }

  get style(): StyleManager2 {
  if (!this.styleManager) this.styleManager = new StyleManager2(this);
  return this.styleManager;
}

  get dataset(): DatasetManager {
    if (!this.datasetManager) this.datasetManager = new DatasetManager(this);
    return this.datasetManager;
  }


  // finder methods (convert results → refs)
  find(q: HsonQuery | string): LiveTree {
    const query = typeof q === 'string' ? parseSelector_NEW(q) : q;
    const found = this.search(this.selectedNodes, query, { findFirst: true });
    return new LiveTree(found);
  }

  findAll(q: HsonQuery | string): LiveTree {
    const query = typeof q === 'string' ? parseSelector_NEW(q) : q;
    const found = this.search(this.selectedNodes, query, { findFirst: false });
    return new LiveTree(found);
  }

  at(index: number): LiveTree {
    const n = this.selectedNodes[index];
    return new LiveTree(n ? [n] : undefined);
  }

  // === legacy mutators/readers: wrap for now ===

  setAttr($name: string, $value: string | boolean | null): this {
    this.withNodes(nodes => {
      for (const node of nodes) {
        if (!node._meta) node._meta = {};
        if (!node._attrs) node._attrs = {};
        const el = NODE_ELEMENT_MAP.get(node) ?? document.querySelector(`[data-_quid="${ensure_quid(node)}"]`);
        if ($value === false || $value === null) {
          delete node._attrs[$name];
          (el as HTMLElement | null)?.removeAttribute($name);
        } else if ($value === true || $value === $name) {
          delete node._attrs[$name];
          (el as HTMLElement | null)?.setAttribute($name, '');
        } else {
          node._attrs[$name] = $value;
          (el as HTMLElement | null)?.setAttribute($name, String($value));
        }
      }
    });
    return this;
  }

  remove(): this {
    // strip DOM stamp then drop map/selection
    for (const r of this.selected) {
      const el = r.resolveEl();
      el?.remove();
      const n = r.resolveNode();
      if (n) {
        NODE_ELEMENT_MAP.delete(n);
        // policy: drop mapping entirely on remove (or keep for undo)
        // drop_quid(n); // if I want to invalidate the handle
      }
    }
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
  setValue($value: string): this {
    for (const node of this.selectedNodes) {
      // This method only applies to specific tags.
      if (node._tag !== 'input' && node._tag !== 'textarea') {
        console.warn(`setValue() called on a <${node._tag}> element. This method is intended only for <input> and <textarea>.`);
        continue; // Skip to the next node
      }

      /*  Sync the live DOM element's .value **property**. */
      const liveElement = NODE_ELEMENT_MAP.get(node);
      if (liveElement && 'value' in liveElement) {
        (liveElement as HTMLInputElement | HTMLTextAreaElement).value = $value;
      }
      /* sync 'value' **attribute**
             (ensures data model consistency for both inputs and textareas) */
      if (!node._meta) node._meta = {};
      if (!node._attrs) node._attrs = {};
      node._attrs.value = $value;
    }
    return this;
  }

  setContent($content: string): this {
    for (const node of this.selectedNodes) {
      const textNode = CREATE_NODE({ _tag: STR_TAG, _content: [$content] });
      node._content = [textNode];

      const liveElement = NODE_ELEMENT_MAP.get(node);
      if (liveElement) {
        liveElement.textContent = $content;
      }
    }
    return this;
  }


  removeAttr($name: string): this {
    return this.setAttr($name, null);
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
  public getElementFor(node: HsonNode): HTMLElement | undefined {
    return NODE_ELEMENT_MAP.get(node)
      ?? (() => {
        const q = ensure_quid(node); // safe: generates if missing
        const el = document.querySelector(`[data-_quid="${q}"]`) as HTMLElement | null;
        return el ?? undefined; // ← normalize null → undefined
      })();
  }


  asDomElement(): HTMLElement | undefined {
    const n = this.selectedNodes[0];
    if (!n) {
      console.warn('[asDomElement] no nodes found in .seleted');
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
      if (el) el.setAttribute(_DATA_QUID, q);
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

