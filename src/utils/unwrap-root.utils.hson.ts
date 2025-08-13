// unwrap-root.utils.hson.ts

import { ROOT_TAG, ELEM_TAG } from "../types-consts/constants.hson";
import { HsonNode } from "../types-consts/node.types.hson";
import { is_Node } from "./node-guards.utils.hson";


/**
 * takes one or more HsonNodes and pops them out of <_root<_elem< structure
 * @param $content the HsonNode or array of HsonNodes to unwrap
 * @returns a clean array of the actual content nodes sans _root or _elem
 */
export function unwrap_root($content: HsonNode | HsonNode[]): HsonNode[] {
    const nodes = Array.isArray($content) ? $content : [$content];
    
    // Use flatMap to handle nodes that might expand into multiple children
    return nodes.flatMap(node => {
        if (node._tag === ROOT_TAG) {
            const childNode = node._content?.[0];
            // If it's a valid container, return its children
            if (is_Node(childNode) && childNode._tag === ELEM_TAG) {
                return childNode._content?.filter(is_Node) || [];
            } 
        }
        // If it's not a container, just return the node itself
        return [node];
    });
}