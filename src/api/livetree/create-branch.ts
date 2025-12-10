// live-tree-branch.utils.ts

import { HsonNode } from "../../types-consts";
import { unwrap_root_elem } from "../../utils/html-utils/unwrap-root-elem.new.utils";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { create_live_tree2 } from "./create-live-tree";
import { LiveTree } from "./livetree";


/**
 * Normalize a root HSON node into a LiveTree root and populate the
 * NODE_ELEMENT_MAP via create_live_tree.
 *
 * Rules:
 *  - If the node is `_root` with a single child, unwrap to that child.
 *  - Otherwise, use the node as-is.
 *
 * This keeps `_root` as a purely structural wrapper that never becomes
 * a LiveTree selection root or listener target.
 */
export function createBranchFromNode2(rootNode: HsonNode): LiveTree {
  const unwrapped = unwrap_root_elem(rootNode);
  if (unwrapped.length === 0) {
    console.warn("createBranchFromNode: nothing to unwrap; falling back to rootNode");
    unwrapped.push(rootNode);
  }
  if (unwrap_root_elem.length !== 1) {
    _throw_transform_err(
      `createBranchFromNode: expected exactly 1 root for LiveTree.asBranch(), got ${unwrapped.length}`,
      "createBranchFromNode",
    );
  }

  const actualRoot = unwrapped[0];

  create_live_tree2(actualRoot);   // populate NODE_ELEMENT_MAP for real element nodes
  return new LiveTree(actualRoot);
}
