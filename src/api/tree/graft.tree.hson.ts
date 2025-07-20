// graft.tree.hson.ts

import { ELEM_TAG, NODE_ELEMENT_MAP } from "../../types-consts/constants.types.hson.js";
import { is_Node, is_BasicValue } from "../../utils/is-helpers.utils.hson.js";
import { parse_html } from "../parsers/parse-html.transform.hson.js";
import { LiveTree } from "./live-tree-class.tree.hson.js";
import { create_live_tree } from "./create-live-tree.tree.hson.js";

  
  /**
   * grafts the hson model onto a DOM element, making it live and interactive
   *  - parses the element's existing HTML, rebuilds it as an HSON-managed
   *     DOM tree, and returns a queryable HsonTree instance that auto-updates
   * @param {HTMLElement} $element the target HTMLElement to graft onto (default = document.body)
   * @returns {LiveTree}an HsonTree instance for querying and manipulating the grafted element
   */

  /* TODO TASK BUG **wire in sanitize ASAP** */
  export function graft($element?: HTMLElement): LiveTree {
    /* get target element or document.body if no arg */
    const targetElement = $element || document.body;
  
    /* copy current HTML content of target */
    const sourceHTML = targetElement.innerHTML;
  
    /* parse html into nodes */
    const rootNode = parse_html(sourceHTML);
  
    /* recursively render the HsonNode tree back into live DOM elements,
        then populate the `nodeElementMap`, linking the two */
    const newDOMFragment = document.createDocumentFragment();
    /* expect a single root or an array of siblings in an _elem */
    const nodesToRender = rootNode.tag === ELEM_TAG && rootNode.content ? rootNode.content.filter(is_Node) : [rootNode];
    
    for(const node of nodesToRender) {
        newDOMFragment.appendChild(create_live_tree(node));
    }
  
  
    /* replace the DOM element with the new liveTree-controlled model */
    targetElement.innerHTML = "";
    targetElement.appendChild(newDOMFragment);
  
    /* return queryable liveTree */
    return new LiveTree(rootNode);
  }
  