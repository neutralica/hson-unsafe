import { HsonNode } from "../../types-consts";
import { ROOT_TAG } from "../../types-consts/constants";
import { is_Node } from "./node-guards.new.utils";

export function unwrap_returned_root(root: HsonNode): ReadonlyArray<HsonNode> {
  // CHANGED: if caller gives us <_root>, return its *element* children; else treat the node itself as a 1-item fragment
  if (root._tag === ROOT_TAG) {
    const kids = root._content ?? [];
    // Only real nodes (skip strings, etc.), stable order
    const out: HsonNode[] = [];
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (is_Node(k)) out.push(k);
    }
    return out;
  }
  return [root];
}