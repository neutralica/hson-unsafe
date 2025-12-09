// node-element-map.ts

import { HsonNode } from "../../types-consts";
import { NODE_ELEMENT_MAP } from "../../types-consts/constants";


//  single registration point
export function linkNodeToElement(node: HsonNode, el: Element): void {
  NODE_ELEMENT_MAP.set(node, el);
}

//  safe lookup with optional logging/guard
export function element_for_node(node: HsonNode): Element | undefined {
  return NODE_ELEMENT_MAP.get(node);
}

//  optional helpers
export function unlinkNode(node: HsonNode): void {
  NODE_ELEMENT_MAP.delete(node);
}

export function hasElementForNode(node: HsonNode): boolean {
  return NODE_ELEMENT_MAP.has(node);
}
