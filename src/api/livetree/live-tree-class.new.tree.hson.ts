// live-tree-class.tree.hson.ts

import { Primitive } from "../../core/types-consts/core.types.hson";
import { is_Node_NEW } from "../../utils/node-guards.new.utils.hson";
import { _DATA_QUID, ensure_quid } from "../../quid/data-quid.quid.hson";
import { STR_TAG } from "../../types-consts/constants.hson";
import { NODE_ELEMENT_MAP_NEW, NEW_NEW_NODE } from "../../types-consts/constants.new.hson";
import { HsonAttrs_NEW, HsonMeta_NEW, HsonNode_NEW } from "../../types-consts/node.new.types.hson";
import { append_NEW } from "./tree-methods/append.new.tree.hson";
import { DatasetManager_NEW } from "./tree-methods/dataset-manager.new.tree.hson";
import { empty_NEW } from "./tree-methods/empty.tree.new.utils.hson";
import { getContent_NEW } from "./tree-methods/get-content.new.tree.hson";
import { removeChild_NEW } from "./tree-methods/remove-child.tree.new.utils.hson";
import StyleManager_NEW from "./tree-methods/style-manager.new.utils.hson";
import { parseSelector_NEW } from "./tree-utils/parse-selector.utils.hson";

/*  defines the shape of the query object for find() and findAll() */
export interface HsonQuery_NEW {
  tag?: string;
  attrs?: Partial<HsonAttrs_NEW>;
  meta?: Partial<HsonMeta_NEW>
  text?: string | RegExp;
}

export class LiveTree_NEW {
  private selectedNodes: HsonNode_NEW[];

  // NEW: Lazily instantiated managers for style and dataset
  private styleManager: StyleManager_NEW | null = null;
  private datasetManager: DatasetManager_NEW | null = null;
  public append = append_NEW
  public empty = empty_NEW;
  public removeChild = removeChild_NEW;
  public getContent = getContent_NEW


  constructor($nodes?: HsonNode_NEW | HsonNode_NEW[] | LiveTree_NEW) {
    if ($nodes instanceof LiveTree_NEW) {
      this.selectedNodes = $nodes.selectedNodes;
    } else if (Array.isArray($nodes)) {
      this.selectedNodes = $nodes.filter(is_Node_NEW);
    } else if ($nodes && is_Node_NEW($nodes)) {
      this.selectedNodes = [$nodes];
    } else {
      this.selectedNodes = [];
    }
  }


  /**
   * access the style manager for the current selection
   * allows for `tree.style.set('color', 'red')` insted of 
   * passing long strings
   */
  get style(): StyleManager_NEW {
    if (!this.styleManager) {
      this.styleManager = new StyleManager_NEW(this);
    }
    return this.styleManager;
  }

  /**
   * accesses the dataset manager for the current selection
   * allows for `tree.dataset.set('userId', '123')`instead of whole-string
   */
  get dataset(): DatasetManager_NEW {
    if (!this.datasetManager) {
      this.datasetManager = new DatasetManager_NEW(this);
    }
    return this.datasetManager;
  }

  /*  finder methods  */

  find($query: HsonQuery_NEW | string): LiveTree_NEW {
    const queryObject = typeof $query === 'string' ? parseSelector_NEW($query) : $query;
    const foundNode = this.search(this.selectedNodes, queryObject, { findFirst: true });
    return new LiveTree_NEW(foundNode);
  }

  findAll($query: HsonQuery_NEW | string): LiveTree_NEW {
    const queryObject = typeof $query === 'string' ? parseSelector_NEW($query) : $query;
    const foundNodes = this.search(this.selectedNodes, queryObject, { findFirst: false });
    return new LiveTree_NEW(foundNodes);
  }

  at(index: number): LiveTree_NEW {
    return new LiveTree_NEW(this.selectedNodes[index]);
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
      const liveElement = NODE_ELEMENT_MAP_NEW.get(node);
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
      const textNode = NEW_NEW_NODE({ _tag: STR_TAG, _content: [$content] });
      node._content = [textNode];

      const liveElement = NODE_ELEMENT_MAP_NEW.get(node);
      if (liveElement) {
        liveElement.textContent = $content;
      }
    }
    return this;
  }

  setAttr($name: string, $value: string | boolean | null): this {
    for (const node of this.selectedNodes) {
      if (!node._meta) node._meta = {};
      if (!node._attrs) node._attrs = {};
      const liveElement = NODE_ELEMENT_MAP_NEW.get(node);

      if ($value === false || $value === null) {
        delete node._attrs[$name];
        liveElement?.removeAttribute($name);
      } else if ($value === true || $value === $name) {
        delete node._attrs[$name];
        liveElement?.setAttribute($name, '');
      } else {
        node._attrs[$name] = $value;
        liveElement?.setAttribute($name, String($value));
      }
    }
    return this;
  }

  removeAttr($name: string): this {
    return this.setAttr($name, null);
  }

  /**
   * removes the calling nodes from its place in the DOM and data model
   */
  remove(): this {
    for (const node of this.selectedNodes) {
      /* Remove from the DOM */
      const liveElement = NODE_ELEMENT_MAP_NEW.get(node);
      liveElement?.remove();
      /* this feels fragile */
      NODE_ELEMENT_MAP_NEW.delete(node);
    }
    /*  Clear the current selection  */
    this.selectedNodes = [];
    return this;
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
    if (this.selectedNodes.length === 0) return '';
    const node = this.selectedNodes[0];
    if (!node) return '';
    const liveElement = NODE_ELEMENT_MAP_NEW.get(node);
    return liveElement?.textContent ?? '';
  }

  count(): number {
    return this.selectedNodes.length;
  }

  getValue(): string {
    if (this.selectedNodes.length === 0) return '';
    const liveElement = NODE_ELEMENT_MAP_NEW.get(this.selectedNodes[0]);
    return (liveElement as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';
  }

  asDomElement(): HTMLElement | null {
    if (this.selectedNodes.length === 0) return null;
    const element = NODE_ELEMENT_MAP_NEW.get(this.selectedNodes[0]);
    return element || null;
  }

  /**
   * Returns the raw HsonNode(s) for debugging.
   * @param all - If true, returns the entire array of selected nodes. Otherwise, returns the first.
   */
  sourceNode(all: boolean = true, index?: number): HsonNode_NEW | HsonNode_NEW[] | undefined {
    if (this.selectedNodes.length === 0) return undefined;
    return all ? this.selectedNodes : this.selectedNodes[index || 0];
  }

  /**
   * helper method to perform the recursive search.
   */
  private search($nodes: HsonNode_NEW[], $query: HsonQuery_NEW, $options: { findFirst: boolean }): HsonNode_NEW[] {
    const results: HsonNode_NEW[] = [];

    const matchAttrs = (node: HsonNode_NEW): boolean => {
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

    const matchMeta = (node: HsonNode_NEW): boolean => {
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
    const nodeText = (n: HsonNode_NEW): string => {
      // Prefer live text if present; fall back to model (_str children)
      const el = NODE_ELEMENT_MAP_NEW.get(n);
      if (el) return el.textContent ?? '';
      const kids = (n._content ?? []).filter(is_Node_NEW);
      for (const k of kids) {
        if (k._tag === STR_TAG && typeof k._content?.[0] === 'string') {
          return k._content[0] as string;
        }
      }
      return '';
    };

    const matchText = (node: HsonNode_NEW): boolean => {
      const q = $query.text;
      if (!q) return true;
      const t = nodeText(node);
      return typeof q === 'string' ? t.includes(q) : q.test(t);
    };

    const checkNode = (node: HsonNode_NEW): boolean => {
      const tagOK = !$query.tag || node._tag.toLowerCase() === $query.tag.toLowerCase();
      return tagOK && matchAttrs(node) && matchMeta(node) && matchText(node);
    };

    const traverse = (nodesToSearch: HsonNode_NEW[]) => {
      for (const node of nodesToSearch) {
        if ($options.findFirst && results.length) return;
        if (checkNode(node)) results.push(node);
        const kids = (node._content ?? []).filter(is_Node_NEW);
        if (kids.length) traverse(kids);
      }
    };

    traverse($nodes);
    return $options.findFirst ? results.slice(0, 1) : results;
  }


  // ensure each selected node has a quid, and ensure DOM attribute exists if mounted
  private _materializeHandleIdentity(): void {
    for (const n of this.selectedNodes) {
      // ensure in-memory quid (no persistence)
      const q = ensure_quid(n /* default persist:false */);
      // if this node is mounted, stamp DOM attribute for stable lookup
      const el = NODE_ELEMENT_MAP_NEW.get(n);
      if (el) el.setAttribute(_DATA_QUID, q);
    }
  }

  // remove DOM attribute for the selected nodes (does not remove in-memory mapping)
  // use when detaching/removing from DOM to avoid orphan attributes
  private _stripDomIdentity(): void {
    for (const n of this.selectedNodes) {
      const el = NODE_ELEMENT_MAP_NEW.get(n);
      if (el) el.removeAttribute(_DATA_QUID);
    }
  }

}