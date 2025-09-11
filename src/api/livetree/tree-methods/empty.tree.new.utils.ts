// empty.tree.utils.ts



import { is_Node_NEW } from "../../../utils/node-guards.new.utils";
import { HsonNode_NEW } from "../../../types-consts/node.new.types";
import { LiveTree_NEW } from "../live-tree-class.new.tree";
import { NODE_ELEMENT_MAP_NEW } from "../../../types-consts/constants";

export function empty_NEW(this: LiveTree_NEW): LiveTree_NEW {
    const selectedNodes = (this as any).selectedNodes as HsonNode_NEW[];
    
    for (const node of selectedNodes) {
        // 1. DATA MODEL UPDATE:
        // This is simpler and correctly removes the _elem container.
        if (node._content && node._content.length > 0) {
            // Recursively clean up the map for all descendants before clearing.
            const cleanupDescendants = (nodes: (HsonNode_NEW | any)[]) => {
                for (const child of nodes) {
                    if (is_Node_NEW(child)) {
                        NODE_ELEMENT_MAP_NEW.delete(child);
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
        const liveElement = NODE_ELEMENT_MAP_NEW.get(node);
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