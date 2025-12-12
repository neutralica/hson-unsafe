// node-element-map.ts

import { HsonNode } from "../../types-consts/node.types";
import { NODE_ELEMENT_MAP } from "../../types-consts/constants";


/**
 * Associate a live DOM `Element` with an `HsonNode` in the internal node→element map.
 *
 * This is the single, canonical registration point for establishing the linkage used
 * by DOM-sync operations (style, dataset, append/remove, detach, etc.).
 *
 * Notes:
 * - Uses a `WeakMap`, so entries are eligible for GC when the `HsonNode` is no longer referenced.
 * - Overwrites any prior mapping for the same node.
 *
 * @param node - The HSON node that conceptually “owns” the element.
 * @param el - The concrete DOM element that represents `node` in the live document.
 */
export function linkNodeToElement(node: HsonNode, el: Element): void {
  NODE_ELEMENT_MAP.set(node, el);
}

/**
 * Resolve the DOM `Element` currently associated with an `HsonNode`, if any.
 *
 * This is a safe lookup:
 * - Returns `undefined` when the node is not mounted / not linked.
 * - Does not create or mutate any mapping.
 *
 * Typical callers use this to decide whether a DOM-sync operation is needed,
 * e.g. “update the element if mounted, otherwise only update the HSON graph.”
 *
 * @param node - The HSON node to resolve.
 * @returns The linked DOM element, or `undefined` if none is registered.
 */
export function element_for_node(node: HsonNode): Element | undefined {
  return NODE_ELEMENT_MAP.get(node);
}

//  optional helpers
/**
 * Remove any existing node→element association for the given `HsonNode`.
 *
 * Use this when a node is being detached/unmounted so future sync calls do not
 * accidentally target a stale element reference.
 *
 * @param node - The node whose mapping should be removed.
 */
export function unlinkNode(node: HsonNode): void {
  NODE_ELEMENT_MAP.delete(node);
}
/**
 * Check whether an `HsonNode` currently has an associated live DOM `Element`.
 *
 * This is a convenience wrapper around the underlying `WeakMap.has`.
 *
 * @param node - The node to test.
 * @returns `true` if a mapping exists, otherwise `false`.
 */
export function hasElementForNode(node: HsonNode): boolean {
  return NODE_ELEMENT_MAP.has(node);
}
