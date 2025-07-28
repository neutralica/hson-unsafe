// remove-child.tree.utils.hson.ts

import { HsonNode } from "../../../types-consts/base.types.hson.js";
import { NODE_ELEMENT_MAP } from "../../../types-consts/base.const.hson.js";
import { is_Node } from "../../../utils/is-helpers.utils.hson.js";
import { HsonQuery, LiveTree } from "../live-tree-class.tree.hson.js";



/**
 * find & remove direct child nodes matching a HsonQuery
 *
 * @param $query HsonQuery object identifying children to remove
 * @returns {LiveTree} the current LiveTree instance, allowing for chaining
 */
export function removeChild(this: LiveTree, $query: HsonQuery): LiveTree {
    const selectedNodes = (this as any).selectedNodes as HsonNode[];
    const search = (this as any).search as (nodes: HsonNode[], query: HsonQuery, options: { findFirst: boolean }) => HsonNode[];


    for (const parentNode of selectedNodes) {
        if (!parentNode.content) {
            continue; 
        }

        /*  1. find the direct children to remove from the data model */
        const childrenToRemove = search(parentNode.content.filter(is_Node), $query, { findFirst: false });

        if (childrenToRemove.length === 0) {
            continue; 
        }

        /*  2. sync with the live DOM and cleanup the map */
        for (const childNode of childrenToRemove) {
            const liveElement = NODE_ELEMENT_MAP.get(childNode);
            liveElement?.remove(); // Remove from DOM
            NODE_ELEMENT_MAP.delete(childNode); // Clean up map
        }

        /*  3. update the parent's data model */
        parentNode.content = parentNode.content.filter(child => !childrenToRemove.includes(child as HsonNode));
    }

    return this;
}