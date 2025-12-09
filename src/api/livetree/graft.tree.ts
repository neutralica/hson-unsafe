// graft.tree.hson.ts

import { HsonNode } from "../../types-consts";
import { unwrap_root_elem } from "../../utils/html-utils/unwrap-root-elem.new.utils";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { parse_html } from "../parsers/parse-html.new.transform";
import { create_live_tree } from "./create-live-tree.tree";
import { LiveTree } from "./live-tree-class.tree";


/**
 * grafts the hson model onto a DOM element, making it live and interactive
 *  - parses the element's existing HTML, rebuilds it as an HSON-managed
 *     DOM tree, and returns a queryable HsonTree instance that auto-updates
 * @param {HTMLElement} $element the target HTMLElement to graft onto (default = document.body)
 * @returns {LiveTree} an HsonTree instance for querying and manipulating the grafted element
 */

export function graft(
  $element?: HTMLElement,
  $options: { unsafe: boolean } = { unsafe: false }
): LiveTree {
  const targetElement = $element;
  if (!targetElement) {
    _throw_transform_err('error getting target element', 'graft', $element);
  }

  /* copy current HTML content of target & parse to nodes */
  const sourceHTML = targetElement.innerHTML;
  const rootNode: HsonNode = parse_html(sourceHTML);

  /* recursively render the HsonNode tree back into live DOM elements,
      then populate the `nodeElementMap`, linking the two */
  const newDOMFragment = document.createDocumentFragment();

  /* check for  _root/_elem*/
  const contentNodes = unwrap_root_elem(rootNode);

  // Enforce graft's specific "single node" rule
  if (contentNodes.length !== 1) {
    _throw_transform_err(
      `[ERR: graft()]: expected 1 node, but received ${contentNodes.length}. Wrap multiple elements in a single container.`,
      'graft'
    );
  }
  const nodeToRender = contentNodes[0];

  newDOMFragment.appendChild(create_live_tree(nodeToRender));
  /* replace the DOM element with the new liveTree-controlled model */
  targetElement.replaceChildren(newDOMFragment)
  /* return queryable liveTree */
  return new LiveTree(nodeToRender);
}
