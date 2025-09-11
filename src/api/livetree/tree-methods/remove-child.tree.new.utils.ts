// remove-child.tree.utils.ts


import { is_Node_NEW } from "../../../utils/node-guards.new.utils";
import { HsonNode } from "../../../types-consts/node.new.types";
import { LiveTree } from "../live-tree-class.new.tree";
import { HsonQuery } from "../../../types-consts/tree.new.types";
import { NODE_ELEMENT_MAP } from "../../../types-consts/constants";


/**
 * find & remove direct child nodes matching a HsonQuery
 *
 * @param $query HsonQuery object identifying children to remove
 * @returns {LiveTree} the current LiveTree instance, allowing for chaining
 */
export function removeChild_NEW(this: LiveTree, $query: HsonQuery): LiveTree {
    const selectedNodes = (this as any).selectedNodes as HsonNode[];
    const search = (this as any).search as (nodes: HsonNode[], query: HsonQuery, options: { findFirst: boolean }) => HsonNode[];


    for (const parentNode of selectedNodes) {
        if (!parentNode._content) {
            continue;
        }

        /*  1. find the direct children to remove from the data model */
        const childrenToRemove = search(parentNode._content.filter(is_Node_NEW), $query, { findFirst: false });

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
        parentNode._content = parentNode._content.filter((child: unknown) => !childrenToRemove.includes(child as HsonNode));
    }

    return this;
}