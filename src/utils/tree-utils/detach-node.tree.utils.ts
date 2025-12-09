// detach.ts

import { _listeners_off_for_target } from "../../api/livetree-2/livetree-methods/listen2";
import { HsonNode } from "../../types-consts";
import { NODE_ELEMENT_MAP } from "../../types-consts/constants";
import { is_Node } from "../node-utils/node-guards.new.utils";
import { element_for_node } from "./node-map-helpers.utils";



type NodeWithKids = { _content?: unknown[] };

// Recursively detach a node and all its descendants.
export function detach_node_deep(node: HsonNode): void {
  // 1) recurse first so children go away before parent
  const kids = (node as NodeWithKids)._content;
  if (Array.isArray(kids) && kids.length) {
    for (const child of kids) {
      if (is_Node(child)) detach_node_deep(child);
    }
  }

  // 2) drop listeners and element for this node
  const el = element_for_node(node);
  if (el) {
    _listeners_off_for_target(el);   // ← kill all listeners bound via builder
    // also drop listeners on all DOM descendants in case something attached there
    // (cheap DOM walk; safe even if builder didn’t attach anything below)
    const iter = el.querySelectorAll("*");
    for (let i = 0; i < iter.length; i++) {
      _listeners_off_for_target(iter[i] as unknown as EventTarget);
    }
    el.remove();
  }

  // 3) finally drop the map entry
  NODE_ELEMENT_MAP.delete(node);
}
