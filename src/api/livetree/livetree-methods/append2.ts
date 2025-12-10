// append.tree.ts


import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
import { STR_TAG, ELEM_TAG } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.types";
import { CREATE_NODE } from "../../../types-consts/factories";
import { make_string } from "../../../utils/primitive-utils/make-string.nodes.utils";
import { _throw_transform_err } from "../../../utils/sys-utils/throw-transform-err.utils";
import { LiveTree } from "../livetree";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers.utils";
import { create_live_tree2 } from "../create-live-tree";
import { clone_node } from "../../../utils/node-utils/clone-node.utils";

export function normalize_ix(index: number, length: number): number {
  if (length <= 0) return 0;

  if (index >= 0) {
    return index > length ? length : index;
  }

  const fromEnd = length + index;
  if (fromEnd < 0) return 0;
  return fromEnd;
}

export function append2(
  this: LiveTree,
  $content: LiveTree,
  index?: number,
): LiveTree {
  // Single-node anchor; throws if there is no node.
  const targetNode = this.node;

  // --- normalize content into HsonNode[] -------------------------------
  let nodesToAppend: HsonNode[];
  if (is_Node($content)) {
    nodesToAppend = unwrap_root_elem($content);
  } else {
    _throw_transform_err(
      "[ERR] invalid content provided",
      "append",
      make_string($content),
    );
  }

  // ensure parent has a _content array
  // if (!targetNode._content) targetNode._content = [];

  // find or create the `_elem` container
  let containerNode: HsonNode;
  const firstChild = targetNode._content[0];

  if (is_Node(firstChild) && firstChild._tag === ELEM_TAG) {
    containerNode = firstChild;
  } else {
    containerNode = CREATE_NODE({ _tag: ELEM_TAG, _content: [] });
    // prepend container; leave existing siblings after it
    targetNode._content = [containerNode, ...targetNode._content];
  }

  // if (!containerNode._content) containerNode._content = [];
  const childContent = containerNode._content;

  // --- HSON INSERTION --------------------------------------------------
  if (typeof index === "number") {
    const insertIx = normalize_ix(index, childContent.length);
    childContent.splice(insertIx, 0, ...nodesToAppend);
  } else {
    childContent.push(...nodesToAppend);
  }

  // --- DOM SYNC --------------------------------------------------------
  const liveElement = element_for_node(targetNode);
  if (liveElement) {
    const domChildren = Array.from(liveElement.childNodes);

    if (typeof index === "number") {
      let insertIx = normalize_ix(index, domChildren.length);

      for (const newNode of nodesToAppend) {
        const dom = create_live_tree2(newNode); // Node | DocumentFragment
        const refNode = domChildren[insertIx] ?? null;
        liveElement.insertBefore(dom, refNode);
        insertIx += 1;
      }
    } else {
      for (const newNode of nodesToAppend) {
        const dom = create_live_tree2(newNode);
        liveElement.appendChild(dom);
      }
    }
  }

  return this;
}

