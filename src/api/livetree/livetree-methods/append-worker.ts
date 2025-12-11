import { HsonNode } from "../../../types-consts/node.types";
import { ELEM_TAG } from "../../../types-consts/constants";
import { CREATE_NODE } from "../../../types-consts/factories";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers.utils";
import { create_live_tree2 } from "../create-live-tree";
import { LiveTree } from "../livetree";
import { TreeSelector } from "../../../types-consts/livetree.types";
import { normalize_ix } from "./append2";

export function appendNodesToTree(
  targetNode: HsonNode,
  nodesToAppend: HsonNode[],
  index?: number,
): void {
  if (!targetNode._content) targetNode._content = [];

  // find or create the `_elem` container
  let containerNode: HsonNode;
  const firstChild = targetNode._content[0];

  if (firstChild && typeof firstChild === "object" && firstChild._tag === ELEM_TAG) {
    containerNode = firstChild;
  } else {
    containerNode = CREATE_NODE({ _tag: ELEM_TAG, _content: [] });
    targetNode._content = [containerNode, ...targetNode._content];
  }

  if (!containerNode._content) containerNode._content = [];
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
  if (!liveElement) return;

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


export function appendBranch(
  this: LiveTree,
  branch: LiveTree,
  index?: number,
): LiveTree {
  const targetNode = this.node;        // throws if unbound
  const srcNode = branch.node;

  // optional safety: forbid JSON-ish VSNs if you want HTML-only subtrees
  // assert_htmlish_subtree(srcNode);

  const nodesToAppend: HsonNode[] = unwrap_root_elem(srcNode);

  // preserve host root for pruning / removal
  branch.adoptRoots(this.getHostRoots());

  appendNodesToTree(targetNode, nodesToAppend, index);
  return this;
}


export function appendMulti(
  this: LiveTree,
  branches: TreeSelector | LiveTree[],
  index?: number,
): LiveTree {
  const targetNode = this.node;

  const branchList: LiveTree[] = Array.isArray(branches)
    ? branches
    : branches.toArray();

  const nodesToAppend: HsonNode[] = [];
  for (const b of branchList) {
    const src = b.node;
    // assert_htmlish_subtree(src); // optional guard
    nodesToAppend.push(...unwrap_root_elem(src));
    b.adoptRoots(this.getHostRoots());
  }

  appendNodesToTree(targetNode, nodesToAppend, index);
  return this;
}