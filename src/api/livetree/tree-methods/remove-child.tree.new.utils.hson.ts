// remove-child.tree.utils.hson.ts


import { is_Node_NEW } from "../../../utils/node-guards.new.utils.hson";
import { NODE_ELEMENT_MAP_NEW } from "../../../types-consts/constants.new.hson";
import { HsonNode_NEW } from "../../../types-consts/node.new.types.hson";
import { LiveTree_NEW } from "../live-tree-class.new.tree.hson";
import { HsonQuery_NEW } from "../../../types-consts/tree.types.hson";


/**
 * find & remove direct child nodes matching a HsonQuery
 *
 * @param $query HsonQuery object identifying children to remove
 * @returns {LiveTree} the current LiveTree instance, allowing for chaining
 */
export function removeChild_NEW(this: LiveTree_NEW, $query: HsonQuery_NEW): LiveTree_NEW {
    const selectedNodes = (this as any).selectedNodes as HsonNode_NEW[];
    const search = (this as any).search as (nodes: HsonNode_NEW[], query: HsonQuery_NEW, options: { findFirst: boolean }) => HsonNode_NEW[];


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
            const liveElement = NODE_ELEMENT_MAP_NEW.get(childNode);
            liveElement?.remove(); // Remove from DOM
            NODE_ELEMENT_MAP_NEW.delete(childNode); // Clean up map
        }

        /*  3. update the parent's data model */
        parentNode._content = parentNode._content.filter((child: unknown) => !childrenToRemove.includes(child as HsonNode_NEW));
    }

    return this;
}