import { HsonAttrs, HsonFlags, HsonNode, BasicValue } from "../../types-consts/base.types.hson.js";
import { BLANK_META, ELEM_TAG, NEW_NODE, NODE_ELEMENT_MAP, STRING_TAG } from "../../types-consts/base.const.hson.js";
import { is_Node } from "../../utils/is-helpers.utils.hson.js";
import { parseSelector } from "../../utils/tree-utils/parse-selector.utils.hson.js";
import { create_live_tree } from "./create-live-tree.tree.hson.js";
import { DatasetManager } from "./tree-methods/dataset-manager.tree.hson.js";
import StyleManager from "./tree-methods/style-manager.utils.hson.js";
import { empty } from "./tree-methods/empty.tree.utils.hson.js";
import { removeChild } from "./tree-methods/remove-child.tree.utils.hson.js";

/*  defines the shape of the query object for find() and findAll() */
export interface HsonQuery {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  flags?: Partial<HsonFlags>
  text?: string | RegExp;
}

export class LiveTree {
  private selectedNodes: HsonNode[];

  // NEW: Lazily instantiated managers for style and dataset
  private styleManager: StyleManager | null = null;
  private datasetManager: DatasetManager | null = null;
  public empty = empty
  public removeChild = removeChild;


  constructor($nodes: HsonNode | HsonNode[] | LiveTree) {
    if ($nodes instanceof LiveTree) {
      this.selectedNodes = $nodes.selectedNodes;
    } else {
      this.selectedNodes = Array.isArray($nodes) ? $nodes : [$nodes].filter(is_Node);
    }
  }


  /**
   * access the style manager for the current selection
   * allows for `tree.style.set('color', 'red')` insted of 
   * passing long strings
   */
  get style(): StyleManager {
    if (!this.styleManager) {
      this.styleManager = new StyleManager(this);
    }
    return this.styleManager;
  }

  /**
   * accesses the dataset manager for the current selection
   * allows for `tree.dataset.set('userId', '123')`instead of whole-string
   */
  get dataset(): DatasetManager {
    if (!this.datasetManager) {
      this.datasetManager = new DatasetManager(this);
    }
    return this.datasetManager;
  }

  /*  -vvv- finder methods -vvv- */

  find($query: HsonQuery | string): LiveTree {
    const queryObject = typeof $query === 'string' ? parseSelector($query) : $query;
    const foundNode = this.search(this.selectedNodes, queryObject, { findFirst: true });
    return new LiveTree(foundNode);
  }

  findAll($query: HsonQuery | string): LiveTree {
    const queryObject = typeof $query === 'string' ? parseSelector($query) : $query;
    const foundNodes = this.search(this.selectedNodes, queryObject, { findFirst: false });
    return new LiveTree(foundNodes);
  }

  at(index: number): LiveTree {
    const node = this.selectedNodes[index];
    return new LiveTree(node || []);
  }

  /*  -vvv- action/setter methods -vvv- */

  setContent($content: string): this {
    for (const node of this.selectedNodes) {
      const textNode = NEW_NODE({ tag: STRING_TAG, content: [$content] });
      node.content = [textNode];

      const liveElement = NODE_ELEMENT_MAP.get(node);
      if (liveElement) {
        liveElement.textContent = $content;
      }
    }
    return this;
  }

  setAttr($name: string, $value: string | boolean | null): this {
    for (const node of this.selectedNodes) {
      if (!node._meta) node._meta = BLANK_META;
      if (!node._meta.attrs) node._meta.attrs = {};
      if (!node._meta.flags) node._meta.flags = [];
      const liveElement = NODE_ELEMENT_MAP.get(node);

      if ($value === false || $value === null) {
        delete node._meta.attrs[$name];
        node._meta.flags = node._meta.flags.filter(f => f !== $name);
        liveElement?.removeAttribute($name);
      } else if ($value === true || $value === $name) {
        delete node._meta.attrs[$name];
        if (!node._meta.flags.includes($name)) node._meta.flags.push($name);
        liveElement?.setAttribute($name, '');
      } else {
        node._meta.flags = node._meta.flags.filter(f => f !== $name);
        node._meta.attrs[$name] = $value;
        liveElement?.setAttribute($name, String($value));
      }
    }
    return this;
  }

  removeAttr($name: string): this {
    return this.setAttr($name, null);
  }

  append($content: Partial<HsonNode> | string | LiveTree): this {
    let nodesToAppend: HsonNode[];
    if (typeof $content === 'string') {
      nodesToAppend = [NEW_NODE({ tag: STRING_TAG, content: [$content] })];
    } else if ($content instanceof LiveTree) {
      nodesToAppend = $content.selectedNodes;
    } else if (is_Node($content)) {
      nodesToAppend = [$content];
    } else {
      return this;
    }

    for (const targetNode of this.selectedNodes) {
      if (!targetNode.content) targetNode.content = [];
      let containerNode: HsonNode;
      const firstChild = targetNode.content[0];
      if (is_Node(firstChild) && firstChild.tag === ELEM_TAG) {
        containerNode = firstChild;
      } else {
        containerNode = NEW_NODE({ tag: ELEM_TAG, content: [...targetNode.content] });
        targetNode.content = [containerNode];
      }
      containerNode.content.push(...nodesToAppend);
      const liveElement = NODE_ELEMENT_MAP.get(targetNode);
      if (liveElement) {
        liveElement.innerHTML = '';
        if (containerNode.content) {
          for (const childToRender of containerNode.content) {
            liveElement.appendChild(create_live_tree(childToRender));
          }
        }
      }
    }
    return this;
  }

  /**
   * removes all selected nodes from the DOM and the data model.
   */
  remove(): this {
    for (const node of this.selectedNodes) {
      /* Remove from the DOM */
      const liveElement = NODE_ELEMENT_MAP.get(node);
      liveElement?.remove();
      /* this is fragile */
      NODE_ELEMENT_MAP.delete(node);
    }
    /*  Clear the current selection  */
    this.selectedNodes = [];
    return this;
  }


  /*  -vvv- reader methods -vvv- */

  getAttr($attr: string): BasicValue | undefined {
    if (this.selectedNodes.length === 0) return undefined;
    const node = this.selectedNodes[0];
    if (!node?._meta) return undefined;
    if (node._meta.flags && node._meta.flags.includes($attr)) return true;
    if (node._meta.attrs && $attr in node._meta.attrs) return node._meta.attrs[$attr];
    return undefined;
  }

  getFirstText(): string {
    if (this.selectedNodes.length === 0) return '';
    const node = this.selectedNodes[0];
    if (!node) return '';
    const liveElement = NODE_ELEMENT_MAP.get(node);
    return liveElement?.textContent ?? '';
  }

  count(): number {
    return this.selectedNodes.length;
  }

  getValue(): string {
    if (this.selectedNodes.length === 0) return '';
    const liveElement = NODE_ELEMENT_MAP.get(this.selectedNodes[0]);
    return (liveElement as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';
  }

  asDomElement(): HTMLElement | null {
    if (this.selectedNodes.length === 0) return null;
    const element = NODE_ELEMENT_MAP.get(this.selectedNodes[0]);
    return element || null;
  }

  /**
   * Returns the raw HsonNode(s) for debugging.
   * @param all - If true, returns the entire array of selected nodes. Otherwise, returns the first.
   */
  sourceNode(all: boolean = false): HsonNode | HsonNode[] | undefined {
    if (this.selectedNodes.length === 0) return undefined;
    return all ? this.selectedNodes : this.selectedNodes[0];
  }

  /**
   * helper method to perform the recursive search.
   */
  private search($nodes: HsonNode[], $query: HsonQuery, $options: { findFirst: boolean }): HsonNode[] {
    const results: HsonNode[] = [];

    const checkNode = (node: HsonNode) => {
      /* check for tag match */
      const tagMatch = !$query.tag || node.tag.toLowerCase() === $query.tag.toLowerCase();
      if (!tagMatch) return false;

      /* Check for attribute match */
      // (...and flag match?!?! 12JUL2025)
      let attrsMatch = true;
      if ($query.attrs) {
        for (const key in $query.attrs) {
          if (!node._meta.attrs || node._meta.attrs[key] !== $query.attrs[key]) {
            attrsMatch = false;
            break;
          }
        }
      }
      if (!attrsMatch) return false; // flag flag flag???

      return true;
    };

    const traverse = (nodesToSearch: HsonNode[]) => {
      for (const node of nodesToSearch) {
        if ($options.findFirst && results.length > 0) return; /* stop here if we only need one */

        if (checkNode(node)) {
          results.push(node);
        }

        /* recurse into children */
        if (node.content && node.content.length > 0) {
          traverse(node.content.filter(is_Node));
        }
      }
    };

    traverse($nodes);
    return $options.findFirst ? results.slice(0, 1) : results;
  }



}