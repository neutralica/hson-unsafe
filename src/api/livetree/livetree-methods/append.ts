// append.ts

import { is_Node } from "../../../utils/node-utils/node-guards";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem";
import { STR_TAG, ELEM_TAG } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.types";
import { CREATE_NODE } from "../../../types-consts/factories";
import { make_string } from "../../../utils/primitive-utils/make-string.nodes.utils";
import { _throw_transform_err } from "../../../utils/sys-utils/throw-transform-err.utils";
import { LiveTree } from "../livetree";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers";
import { create_live_tree2 } from "../create-live-tree";

/**
 * Normalize an insertion index for an array of a given length.
 *
 * Positive indexes are clamped to the range `[0, length]`, so values
 * larger than `length` insert at the end. Negative indexes are treated
 * as offsets from the end (like `Array.prototype.at`), and are clamped
 * to `0` if they go past the start.
 *
 * @param index - Requested insertion index (may be negative to count from the end).
 * @param length - Current length of the array being indexed into.
 * @returns A safe insertion index in the range `[0, length]`.
 */
export function normalize_ix(index: number, length: number): number {
  if (length <= 0) return 0;

  if (index >= 0) {
    return index > length ? length : index;
  }

  const fromEnd = length + index;
  if (fromEnd < 0) return 0;
  return fromEnd;
}

/**
 * Append a `LiveTree` branch as children of this `LiveTree`'s node,
 * updating both the HSON structure and the bound DOM subtree.
 *
 * The incoming `content` branch is normalized to a list of HSON nodes
 * via `unwrap_root_elem`, so its root `_elem` wrapper is not appended.
 * The nodes are then inserted into the target node's `_elem` container,
 * creating that container if needed. Insertion position is controlled
 * by `index` (normalized by `normalize_ix`); omitted `index` appends at
 * the end.
 *
 * If a live DOM element is associated with the target node, each new
 * HSON node is rendered with `create_live_tree2` and inserted into the
 * DOM at the corresponding position, keeping HSON and DOM in sync.
 *
 * @this LiveTree - The anchor tree whose node will receive the new children.
 * @param content - The `LiveTree` branch to append into this tree.
 * @param index - Optional insertion index in the `_elem` container;
 *                negative values index from the end, and values outside
 *                the range are clamped.
 * @returns The receiver `LiveTree` for chaining.
 */
export function append(
  this: LiveTree,
  content: LiveTree,
  index?: number,
): LiveTree {
  // Single-node anchor; throws if there is no node.
  const targetNode = this.node;

  // --- normalize content into HsonNode[] -------------------------------
  let nodesToAppend: HsonNode[];
  if (is_Node(content)) {
    nodesToAppend = unwrap_root_elem(content);
  } else {
    _throw_transform_err(
      "[ERR] invalid content provided",
      "append",
      make_string(content),
    );
  }


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

