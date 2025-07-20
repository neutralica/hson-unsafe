import { HsonAttrs, HsonFlags, HsonNode, BasicValue } from "../../types-consts/base.types.hson.js";
import { BLANK_META, ELEM_TAG, NEW_NODE, NODE_ELEMENT_MAP, STRING_TAG } from "../../types-consts/constants.types.hson.js";
import { is_Node } from "../../utils/is-helpers.utils.hson.js";
import { parseSelector } from "../../utils/tree-utils/parse-selector.utils.hson.js";
import { create_live_tree } from "./create-live-tree.tree.hson.js";

/*  defines the shape of the query object for find() and findAll() */
export interface HsonQuery {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  flags?: Partial<HsonFlags>
  text?: string | RegExp;
}

export class LiveTree {
  /*  holds an array of HsonNodes */
  private selectedNodes: HsonNode[];

  constructor($nodes: HsonNode | HsonNode[] | LiveTree) {
    if ($nodes instanceof LiveTree) {
      this.selectedNodes = $nodes.selectedNodes;
    } else {
      this.selectedNodes = Array.isArray($nodes) ? $nodes : [$nodes].filter(is_Node);
    }
  }

  /* --- FINDER METHODS --- */

  /**
   * searches descendants for the first element matching the query
   * @returns{LiveTree} a new HsonTree instance wrapping the found node OR an empty HsonTree
   */

  find($query: HsonQuery | string): LiveTree {
    const queryObject = typeof $query === 'string' ? parseSelector($query) : $query;
    const foundNode = this.search(this.selectedNodes, queryObject, { findFirst: true });
    if (!foundNode) console.warn('no node found; returning empty');
    return new LiveTree(foundNode);
  }

  /**
   * searches for all descendant elements matching the query
   * @returns {LiveTree} a new HsonTree instance containing all found nodes
   */

  findAll($query: HsonQuery | string): LiveTree {
    const queryObject = typeof $query === 'string' ? parseSelector($query) : $query;
    const foundNodes = this.search(this.selectedNodes, queryObject, { findFirst: false });
    return new LiveTree(foundNodes);
  }

  /**
   * gets an attribute or flag value from the first node in the selection
   * reads directly from the HsonNode data model as the source of truth
   *    (the search priority is: flags > attributes)
   *
   * @param $attr the attribute or flag to retrieve
   * @returns {LiveTree} the attribute's value (`true` if the name exists, `null` if not found)
   */


  getAttr($attr: string): BasicValue | undefined {
    if (this.selectedNodes.length === 0) {
      return undefined;
    }

    const node = this.selectedNodes[0];

    if (!node?._meta) {
      return undefined;
    }

    /* ***check flags first*** */
    if (node._meta.flags && node._meta.flags.includes($attr)) {
      return true;
    }

    /* then check attrs */
    if (node._meta.attrs && $attr in node._meta.attrs) {
      return node._meta.attrs[$attr];
    }

    return undefined;
  }

  /* --- ACTION METHODS --- */

  setContent($content: string): this {
    for (const node of this.selectedNodes) {
      /* create the simplest possible content structure */
      const textNode = NEW_NODE({ tag: STRING_TAG, content: [$content] });
      node.content = [textNode];

      /* sync with DOM */
      const liveElement = NODE_ELEMENT_MAP.get(node);
      if (liveElement) {
        liveElement.textContent = $content;
      }
    }
    return this;
  }

  /**
     * sets an attr or a flag on all currently selected nodes. 
     *   dispatches behavior based on the value provided, ensuring
     *   that a given name is only a flag or an attr at one time.
     *
     * @param $name name of the attr or flag.
     * @param $value value to set.
     * - `string`: if `value === name`, it's treated as a flag. Otherwise, it's a standard attribute
     * - `true`: explicitly sets a flag
     * - `false` or `undefined`: Removes the name from both attributes and flags.
     * @returns The current HsonTree instance to allow chaining.
     */
  setAttr($name: string, $value: string | boolean | null): this {
    for (const node of this.selectedNodes) {
      /* _meta setup */
      if (!node._meta) node._meta = BLANK_META;
      if (!node._meta.attrs) node._meta.attrs = {};
      if (!node._meta.flags) node._meta.flags = [];

      const liveElement = NODE_ELEMENT_MAP.get(node);

      /* 1: removal: if value is false or null, remove the name from both attrs and flags */
      if ($value === false || $value === null) {
        delete node._meta.attrs[$name];
        node._meta.flags = node._meta.flags.filter(f => f !== $name);

        /* sync DOM */
        liveElement?.removeAttribute($name);
      }

      /* 2: set flag */
      else if ($value === true || $value === $name) {
        /* ensure no duplication: remove from attributes if it exists there */
        delete node._meta.attrs[$name];
        /* add to flags */
        if (!node._meta.flags.includes($name)) {
          node._meta.flags.push($name);
        }

        /* sync DOM (the HTML convention for a boolean attribute is an empty string) */
        liveElement?.setAttribute($name, '');
      }

      /* 3: set attribute (standard k:v) */
      else {
        /* ensure no duplication: remove from flags if it exists there */
        node._meta.flags = node._meta.flags.filter(f => f !== $name);

        node._meta.attrs[$name] = $value;

        /* sync DOM */
        liveElement?.setAttribute($name, $value);
      }
    }
    return this; /* enable chaining */
  }

  /**
   * convenience method to remove an attribute or flag
   * equivalent to `setAttr(name, null)`
   * @param $name The name of the attribute or flag to remove
   * @returns {LiveTree} The current HsonTree instance to allow chaining
   */
  removeAttr($name: string): this {
    return this.setAttr($name, null);
  }


  /**
   * parses the given content, converts it to HsonNodes, and appends it
   * as a child to each node in the current selection
   *
   * @param $content a partial HsonNode object, a raw string, or another HsonTree instance
   * @returns {LiveTree} the current HsonTree instance to allow for chaining
   */

  // TODO-- this should maybe be BasicValue as the passed arg
  append($content: Partial<HsonNode> | string | LiveTree): this {
    /* normalize input */
    let nodesToAppend: HsonNode[];

    if (typeof $content === 'string') {
      nodesToAppend = [NEW_NODE({ tag: STRING_TAG, content: [$content] })];
    } else if ($content instanceof LiveTree) {
      nodesToAppend = $content.selectedNodes;
    } else if (is_Node($content)) {
      nodesToAppend = [$content];
    } else {
      /* fallback for other primitives? */
      // (feels wrong - 12JUL2025)
      return this;
    }



    /* applies the append operation to every node in the current selection */
    for (const targetNode of this.selectedNodes) {
      if (!targetNode.content) {
        targetNode.content = [];
      }

      /* 3. find or create the `_elem` VSN wrapper for child nodes */
      let containerNode: HsonNode;
      const firstChild = targetNode.content[0];

      if (is_Node(firstChild) && firstChild.tag === ELEM_TAG) {
        /* `_elem` wrapper already exists. Use it. */
        containerNode = firstChild;
      } else {
        /* no `_elem` wrapper found; create one and wrap existing content */
        containerNode = NEW_NODE({ tag: ELEM_TAG, content: [...targetNode.content] });
        targetNode.content = [containerNode];
      }

      /* modify the in-memory model by adding the new nodes to the container */
      containerNode.content.push(...nodesToAppend);

      /* sync with the DOM by re-rendering the parent's content */
      const liveElement = NODE_ELEMENT_MAP.get(targetNode);
      if (liveElement) {

        /* clear the existing DOM content & re-render all children from the updated model */
        liveElement.innerHTML = '';
        if (containerNode.content) {
          for (const childToRender of containerNode.content) {
            liveElement.appendChild(create_live_tree(childToRender));
          }
        }
      }
    }
    return this; /* enable chaining. */
  }


  /* --- READER METHODS --- */

  /**
   * gets the text content of the first node in the current selection.
   */

  getFirstText(): string {
    if (this.selectedNodes.length === 0) return '';

    const node = this.selectedNodes[0];
    if (!node) return '';

    const liveElement = NODE_ELEMENT_MAP.get(node);

    const text = liveElement?.textContent ?? '';

    return text;
  }

  /**
   * gets the number of nodes in the current selection.
   */
  count(): number {
    return this.selectedNodes.length;
  }


  /**
   * gets the `value` property from the first selected form element
   * (like <input>, <textarea>, <select>).
   * @returns The value of the form element as a string.
   */

  // ERR BUG TODO TASK this should return a BasicValue
  getValue(): string {
    if (this.selectedNodes.length === 0) return '';
    const node = this.selectedNodes[0];
    if (!node) return '';

    /* live DOM element linked to this HsonNode */
    const liveElement = NODE_ELEMENT_MAP.get(node);

    /* for form elements, we read the .value property, not textContent.
        (casting is required to access the .value property) */
    return (liveElement as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';
  }

  /**
   * returns the raw, underlying HsonNode for the first item in the selection
   * mainly for advanced debugging or testing the state of the data model directly
   *
   * @returns the raw HsonNode, or undefined if the selection is empty
   */

  // 12JUL2025 changed 'null' return to 'undefined'
  sourceNode(): HsonNode | undefined {
    if (this.selectedNodes.length === 0) {
      return undefined;
    }
    return this.selectedNodes[0];
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


  /**
   * reduces the set of matched nodes to the one at the specified index
   * @param index The (zero-based) index of the element to retrieve
   * @returns {LiveTree} new HsonTree instance containing only the element at the specified index, or 
   *   an empty HsonTree if the index is out of bounds
   */
  at(index: number): LiveTree {
    const node = this.selectedNodes[index];
    /* if a node exists at that index, wrap it in an HsonTree
       otherwise return a new, empty tree. */
    return new LiveTree(node || []);
  }

  /**
     * returns the underlying in-DOM HTMLElement for the first selected node
     * useful for attaching event listeners or direct dom manipulation
     */
  domElement(): HTMLElement | null {
    if (this.selectedNodes.length === 0) {
      return null;
    }

    const element = NODE_ELEMENT_MAP.get(this.selectedNodes[0]);
    return element || null;
  }

}