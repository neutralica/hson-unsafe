// empty.tree.utils.hson.ts

import { HsonNode } from "../../../types-consts/types.hson.js";
import { ELEM_TAG, NODE_ELEMENT_MAP } from "../../../types-consts/constants.hson.js";
import { is_Node } from "../../../utils/is-helpers.utils.hson.js";
import { LiveTree } from "../live-tree-class.tree.hson.js";
import { make_string } from "../../../utils/make-string.utils.hson.js";


export function empty(this: LiveTree): LiveTree {
    const selectedNodes = (this as any).selectedNodes as HsonNode[];
    
    for (const node of selectedNodes) {
        // 1. DATA MODEL UPDATE:
        // This is simpler and correctly removes the _elem container.
        if (node._content && node._content.length > 0) {
            // Recursively clean up the map for all descendants before clearing.
            const cleanupDescendants = (nodes: (HsonNode | any)[]) => {
                for (const child of nodes) {
                    if (is_Node(child)) {
                        NODE_ELEMENT_MAP.delete(child);
                        if (child._content) {
                            cleanupDescendants(child._content);
                        }
                    }
                }
            };
            cleanupDescendants(node._content);
            
            // Set the content to an empty array. This is the correct state.
            node._content = [];
        }

        // 2. DOM SYNCHRONIZATION:
        const liveElement = NODE_ELEMENT_MAP.get(node);
        if (liveElement) {
            
            while (liveElement.firstChild) {
                liveElement.removeChild(liveElement.firstChild);
            }

        } else {
            console.error('FAILURE: Could not find node in NODE_ELEMENT_MAP during empty().');
        }
    }
    return this;
}