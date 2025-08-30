// append.tree.hson.ts

import { ELEM_TAG, NEW_NODE, NODE_ELEMENT_MAP, STR_TAG } from "../../../types-consts/constants.hson.js";
import { HsonNode } from "../../../types-consts/node.types.hson.js";
import { is_Node } from "../../../utils/node-guards.utils.hson.js";
import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson.js";
import { unwrap_root } from "../../../utils/unwrap-root.utils.hson.js";
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
        nodesToAppend = [NEW_NODE({ _tag: STR_TAG, _content: [$content] })];
    } else if ($content instanceof LiveTree) {
        const sourceNodes = $content.sourceNode(true) as HsonNode[];
        // Use the new utility. It correctly handles the array and returns a flat array.
        nodesToAppend = unwrap_root(sourceNodes);
    } else if (is_Node($content)) {
        // Use the same utility for a single node. It will return a clean array.
        nodesToAppend = unwrap_root($content);
    } else {
        _throw_transform_err('[ERR] invalid content provided', 'append');
    }

    for (const targetNode of selectedNodes) {
        if (!targetNode._content) targetNode._content = [];

        /* find or create the _elem VSN wrapper for child nodes */
        let containerNode: HsonNode;
        const firstChild = targetNode._content[0];
        if (is_Node(firstChild) && firstChild._tag === ELEM_TAG) {
            containerNode = firstChild;
        } else {
            containerNode = NEW_NODE({ _tag: ELEM_TAG, _content: [...targetNode._content] });
            targetNode._content = [containerNode];
        }

        /* push the new nodes to the data model */
        containerNode._content.push(...nodesToAppend);

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
