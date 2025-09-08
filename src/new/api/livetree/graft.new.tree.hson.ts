// graft.tree.hson.ts

import { parse_html } from "../../../api/parsers/parse-html.transform.hson";
import { sanitize_html } from "../../../utils/sanitize-html.utils.hson";
import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson";
import { HsonNode_NEW } from "../../types-consts/node.new.types.hson";
import { unwrap_root_NEW } from "../../utils/unwrap-root.new.utils.hson";
import { create_live_tree_NEW } from "./create-live-tree.new.tree.hson";
import { LiveTree_NEW } from "./live-tree-class.new.tree.hson";


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
 * @returns {LiveTree_NEW}an HsonTree instance for querying and manipulating the grafted element
 */

export function graft_NEW(
  $element?: HTMLElement,
  $options: { unsafe: boolean } = { unsafe: false }
): LiveTree_NEW {
  /* get target element or document.body if no arg */
  // WARN BUG default alert - do we want to default to document.body here? 
  const targetElement = $element;
  if (!targetElement) {
    _throw_transform_err('error getting target element', 'graft', $element);
  }
  /* copy current HTML content of target */
  const sourceHTML = targetElement.innerHTML;
  /* parse html into nodes */
  const cleanHTML = $options.unsafe ? sourceHTML : sanitize_html(sourceHTML);
  const rootNode: HsonNode_NEW = parse_html(cleanHTML);

  /* recursively render the HsonNode tree back into live DOM elements,
      then populate the `nodeElementMap`, linking the two */
  const newDOMFragment = document.createDocumentFragment();

  /* check for  _root/_elem*/
   const contentNodes = unwrap_root_NEW(rootNode);

    // Enforce graft's specific "single node" rule
    if (contentNodes.length !== 1) {
      _throw_transform_err(
        `[ERR: graft()]: expected 1 node, but received ${contentNodes.length}. Wrap multiple elements in a single container.`,
        'graft'
      );
    }
    const nodeToRender = contentNodes[0];

  newDOMFragment.appendChild(create_live_tree_NEW(nodeToRender));
  /* replace the DOM element with the new liveTree-controlled model */
  targetElement.innerHTML = "";
  targetElement.appendChild(newDOMFragment);

  /* return queryable liveTree */
  return new LiveTree_NEW(nodeToRender);
}
