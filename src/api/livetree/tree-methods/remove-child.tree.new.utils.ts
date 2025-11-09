// remove-child.tree.utils.ts


import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { HsonNode } from "../../../types-consts/node.new.types";
import { LiveTree } from "../live-tree-class.new.tree";
import { HsonQuery } from "../../../types-consts/tree.new.types";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node.tree.utils";


/**
 * find & remove direct child nodes matching a HsonQuery
 *
 * @param $query HsonQuery object identifying children to remove
 * @returns {LiveTree} the current LiveTree instance, allowing for chaining
 */
export function remove_child(this: LiveTree, $query: HsonQuery): LiveTree {
  const selectedNodes = (this as any).selectedNodes as HsonNode[];
  const search = (this as any).search as (nodes: HsonNode[], q: HsonQuery, o: { findFirst: boolean }) => HsonNode[];

  for (const parent of selectedNodes) {
    const kids = parent._content;
    if (!Array.isArray(kids)) continue;

    // 1) find direct children to remove
    const toRemove = search(kids.filter(is_Node), $query, { findFirst: false });
    if (!toRemove.length) continue;

    // 2) deep detach each child (listeners + DOM + map)
    for (const child of toRemove) detach_node_deep(child);

    // 3) update data model to exclude removed children
    parent._content = kids.filter(ch => !(is_Node(ch) && toRemove.includes(ch)));
  }

  return this;
}