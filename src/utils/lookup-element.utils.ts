// lookup-element.utils.ts

import { HsonNode } from "../types-consts/node.new.types";


export function lookup_element(node: HsonNode): Element | undefined {
    return map_get(node as unknown as object);
}



function ungregister_node(node: HsonNode): void {
  map_delete(node as unknown as object);
  const kids = node._content;
  if (Array.isArray(kids)) {
    for (const child of kids) {
      if (child && typeof child === "object") ungregister_node(child as HsonNode);
    }
  }
}

/* =============================== * 
 *    node registry methods        *
 * =============================== */
// single source of truth for mapping HsonNode -> Element
// create once at module load; no external init required
const REG = new WeakMap<object, Element>();

export function map_set(node: object, dom: Node): void {
  if (dom.nodeType === 1) REG.set(node, dom as Element); // Element
  // If it's a fragment/text/comment, ignore here
}
export function map_get(node: object): Element | undefined { return REG.get(node) ?? undefined; }
export function map_delete(node: object): void { REG.delete(node); }