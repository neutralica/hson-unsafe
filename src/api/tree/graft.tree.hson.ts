// graft.tree.hson.ts

import { ELEM_TAG, NODE_ELEMENT_MAP, OBJECT_TAG, ROOT_TAG } from "../../types-consts/constants.hson.js";
import { is_Node, is_Primitive } from "../../utils/is-helpers.utils.hson.js";
import { parse_html } from "../parsers/parse-html.transform.hson.js";
import { LiveTree } from "./live-tree-class.tree.hson.js";
import { create_live_tree } from "./create-live-tree.tree.hson.js";
import { sanitize_html } from "../../utils/sanitize-html.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { HsonNode } from "../../types-consts/types.hson.js";
import { throw_transform_err } from "../../utils/throw-transform-err.utils.hson.js";

/* debug log */
let _VERBOSE = true;
const _log = _VERBOSE
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
  // WARN BUG default alert - do we want to default to document.body? 
  const targetElement = $element || document.body;
  /* copy current HTML content of target */
  const sourceHTML = targetElement.innerHTML;
  /* parse html into nodes */
  const cleanHTML = $options.unsafe ? sourceHTML : sanitize_html(sourceHTML);
  const rootNode: HsonNode = parse_html(cleanHTML);

  /* recursively render the HsonNode tree back into live DOM elements,
      then populate the `nodeElementMap`, linking the two */
  const newDOMFragment = document.createDocumentFragment();

  /* check for  */
  const unwrappest = (node: HsonNode) => {
    let contentNodes: HsonNode[] = [];

    if (node._tag === ROOT_TAG) {
      const childNode = node._content?.[0];
      if (!is_Node(childNode) || childNode._tag !== ELEM_TAG) {
        throw_transform_err('Malformed _root node', 'graft.unwrap', node);
      }
      contentNodes = childNode._content?.filter(is_Node) || [];
    } else {
      contentNodes = [node];
    }

    // Enforce the "single node" rule inside the helper
    if (contentNodes.length !== 1) {
      throw_transform_err(
        `[ERR: graft()]: multiple (${contentNodes.length}) nodes passed to graft(); wrap multiple elements`,
        'graft',
        contentNodes
      );
    }

    return contentNodes[0];
  }

  const nodesToRender = unwrappest(rootNode);

  newDOMFragment.appendChild(create_live_tree(nodesToRender));
  /* replace the DOM element with the new liveTree-controlled model */
  targetElement.innerHTML = "";
  targetElement.appendChild(newDOMFragment);

  /* return queryable liveTree */
  return new LiveTree(nodesToRender);
}
