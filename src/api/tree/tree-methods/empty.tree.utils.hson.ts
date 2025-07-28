// empty.tree.utils.hson.ts

import { HsonNode } from "../../../types-consts/base.types.hson.js";
import { NODE_ELEMENT_MAP } from "../../../types-consts/base.const.hson.js";
import { is_Node } from "../../../utils/is-helpers.utils.hson.js";
import { LiveTree } from "../live-tree-class.tree.hson.js";


/**
 * Removes all child nodes from each of the currently selected elements.
 * This is equivalent to jQuery's .empty().
 *
 * @returns {LiveTree} The current LiveTree instance to allow for chaining.
 */
export function empty(this: LiveTree): LiveTree {
    const selectedNodes = (this as any).selectedNodes as HsonNode[];

    for (const node of selectedNodes) {
        // 1. Clear the data model
        if (node.content) {
            // Recursively clean up the node map for all descendants
            const cleanupDescendants = (nodes: (HsonNode | any)[]) => {
                for (const child of nodes) {
                    if (is_Node(child)) {
                        NODE_ELEMENT_MAP.delete(child);
                        if (child.content) {
                            cleanupDescendants(child.content);
                        }
                    }
                }
            };
            cleanupDescendants(node.content);
            node.content = [];
        }

        // 2. Sync with the live DOM
        const liveElement = NODE_ELEMENT_MAP.get(node);
        if (liveElement) {
            liveElement.innerHTML = '';
        }
    }

    return this;
}
