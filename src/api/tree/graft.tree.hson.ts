// graft.tree.hson.ts

import { ELEM_TAG, NODE_ELEMENT_MAP, OBJECT_TAG, ROOT_TAG } from "../../types-consts/constants.types.hson.js";
import { is_Node, is_BasicValue } from "../../utils/is-helpers.utils.hson.js";
import { parse_html } from "../parsers/parse-html.transform.hson.js";
import { LiveTree } from "./live-tree-class.tree.hson.js";
import { create_live_tree } from "./create-live-tree.tree.hson.js";
import { sanitize_html } from "../../utils/sanitize-html.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { HsonNode } from "../../types-consts/base.types.hson.js";
import { throw_transform_err } from "../../utils/throw-transform-err.utils.hson.js";

/* debug log */
let _VERBOSE = true;
const $log = _VERBOSE
  ? console.log
  : () => { };



/**
 * grafts the hson model onto a DOM element, making it live and interactive
 *  - parses the element's existing HTML, rebuilds it as an HSON-managed
 *     DOM tree, and returns a queryable HsonTree instance that auto-updates
 * @param {HTMLElement} $element the target HTMLElement to graft onto (default = document.body)
 * @returns {LiveTree}an HsonTree instance for querying and manipulating the grafted element
 */

/* TODO TASK BUG **wire in sanitize ASAP** */
export function graft(
  $element?: HTMLElement,
  $options: { unsafe: boolean } = { unsafe: false }
): LiveTree {
  /* get target element or document.body if no arg */
  const targetElement = $element || document.body;
  /* copy current HTML content of target */
  const sourceHTML = targetElement.innerHTML;
  /* parse html into nodes */
  const cleanHTML = $options.unsafe ? sourceHTML : sanitize_html(sourceHTML);
  const rootNode = parse_html(cleanHTML);

  /* recursively render the HsonNode tree back into live DOM elements,
  then populate the `nodeElementMap`, linking the two */
  const newDOMFragment = document.createDocumentFragment();

  /* check for  */
  const unwrappest = (node: HsonNode) => {
    if (node.tag === ROOT_TAG) {
      const childNode = node.content[0];
      if (
        !is_Node(childNode) ||
        (childNode.tag !== ELEM_TAG)) {
        throw_transform_err('[ERR: graft()] \n -> malformed _root node', 'graft', node);
      }
      return childNode.content
    }
    return [node];
  }

  const nodesToRender = unwrappest(rootNode);

  for (const node of nodesToRender) {
    newDOMFragment.appendChild(create_live_tree(node));
  }

  /* replace the DOM element with the new liveTree-controlled model */
  targetElement.innerHTML = "";
  targetElement.appendChild(newDOMFragment);

  /* return queryable liveTree */
  return new LiveTree(rootNode);
}
