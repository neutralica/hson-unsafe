// lookup-element.utils.ts

import { HsonNode } from "../types-consts/node.new.types";


export function lookup_element(node: HsonNode): Element | undefined {
  const map = (globalThis as any).NODE_ELEMENT_MAP as Map<HsonNode, Element> | undefined;
  return map?.get(node) ?? undefined;
}