// append.tree.hson.ts

import { ELEM_TAG, NEW_NODE, NODE_ELEMENT_MAP, STRING_TAG } from "../../../types-consts/constants.hson.js";
import { HsonNode } from "../../../types-consts/types.hson.js";
import { is_Node } from "../../../utils/is-helpers.utils.hson.js";
import { create_live_tree } from "../create-live-tree.tree.hson.js";
import { LiveTree } from "../live-tree-class.tree.hson.js";


/**
 * Parses content and appends it as a child to each node in the current selection.
 * This method ADDS to the end of the existing content, it does not replace it.
 *
 * @param $content The content to append.
 * @returns The current LiveTree instance for chaining.
 */
export function append(this: LiveTree, $content: Partial<HsonNode> | string | LiveTree): LiveTree {
    const selectedNodes = (this as any).selectedNodes as HsonNode[];
    
    let nodesToAppend: HsonNode[];
    if (typeof $content === 'string') {
        nodesToAppend = [NEW_NODE({ tag: STRING_TAG, content: [$content] })];
    } else if ($content instanceof LiveTree) {
        const contentSrc = $content.sourceNode();
        if (!contentSrc) throw new Error('no content provided');
        nodesToAppend = Array.isArray(contentSrc) ? contentSrc : [contentSrc];
    } else if (is_Node($content)) {
        nodesToAppend = [$content];
    } else {
        console.warn('invalid content provided');
        return this; // Invalid content, do nothing
    }

    for (const targetNode of selectedNodes) {
        if (!targetNode.content) targetNode.content = [];

        /* find or create the _elem VSN wrapper for child nodes */
        let containerNode: HsonNode;
        const firstChild = targetNode.content[0];
        if (is_Node(firstChild) && firstChild.tag === ELEM_TAG) {
            containerNode = firstChild;
        } else {
            containerNode = NEW_NODE({ tag: ELEM_TAG, content: [...targetNode.content] });
            targetNode.content = [containerNode];
        }

        /* push the new nodes to the data model */
        containerNode.content.push(...nodesToAppend);

        /* appending only the new elements to the DOM to sync with data */
        const liveElement = NODE_ELEMENT_MAP.get(targetNode);
        if (liveElement) {
            for (const newNode of nodesToAppend) {
                liveElement.appendChild(create_live_tree(newNode));
            }
        }
    }
    return this;
}
