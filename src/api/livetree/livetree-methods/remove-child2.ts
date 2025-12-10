import { HsonQuery } from "../../../types-consts";
import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node.tree.utils";
import { parse_selector } from "../../../utils/tree-utils/parse-selector.utils";
import { LiveTree } from "../livetree";
import { search_nodes } from "./search2";

export function remove_child2(
  this: LiveTree,
  query: HsonQuery | string,
): LiveTree {
  // Single-node model: there is exactly one parent.
  const parent = this.node;
  const kids = parent._content;

  if (!Array.isArray(kids) || kids.length === 0) {
    // nothing to do
    return this;
  }

  // Only node children participate in the selector search.
  const nodeKids = kids.filter(is_Node);
  if (nodeKids.length === 0) {
    return this;
  }

  const q: HsonQuery =
    typeof query === "string" ? parse_selector(query) : query;

  // Find all direct children that match.
  const toRemove = search_nodes(nodeKids, q, { findFirst: false });
  if (!toRemove.length) {
    return this;
  }

  // Deep detach each child (listeners + DOM + NODE_ELEMENT_MAP, etc.)
  for (const child of toRemove) {
    detach_node_deep(child);
  }

  // Build a new child list without the removed nodes.
  // Using a Set avoids O(n²) filter+includes.
  const removeSet = new Set(toRemove);
  const nextKids: typeof kids = [];

  for (const ch of kids) {
    if (is_Node(ch) && removeSet.has(ch)) {
      continue; // skip removed node
    }
    nextKids.push(ch);
  }

  parent._content = nextKids;

  return this;
}