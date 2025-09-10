// unwrap-root.utils.hson.ts

import { ROOT_TAG, ELEM_TAG } from "../types-consts/constants.hson";
import { HsonNode_NEW } from "../types-consts/node.new.types.hson";
import { is_Node_NEW } from "./node-guards.new.utils.hson";


/**
 * takes one or more HsonNodes and pops them out of <_root<_elem< structure
 * @param $content the HsonNode or array of HsonNodes to unwrap
 * @returns a clean array of the actual content nodes sans _root or _elem
 */
export function unwrap_root_NEW($content: HsonNode_NEW | HsonNode_NEW[]): HsonNode_NEW[] {
    const nodes = Array.isArray($content) ? $content : [$content];
    
    /* use flatMap to handle nodes that might expand into multiple children */
    return nodes.flatMap(node => {
        if (node._tag === ROOT_TAG) {
            const childNode = node._content?.[0];
            /* if it's a valid container, return its children */
            if (is_Node_NEW(childNode) && childNode._tag === ELEM_TAG) {
                return childNode._content?.filter(is_Node_NEW) || [];
            } 
        }
        /* if it's not a container, just return the node itself */
        return [node];
    });
}