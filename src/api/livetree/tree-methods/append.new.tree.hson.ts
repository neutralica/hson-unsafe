// append.tree.hson.ts

import { NEW_NEW_NODE, NODE_ELEMENT_MAP_NEW } from "../../../new/types-consts/constants.new.hson";
import { HsonNode_NEW } from "../../../new/types-consts/node.new.types.hson";
import { is_Node_NEW } from "../../../new/utils/node-guards.new.utils.hson";
import { unwrap_root_NEW } from "../../../new/utils/unwrap-root.new.utils.hson";
import { STR_TAG, ELEM_TAG } from "../../../types-consts/constants.hson";
import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson";
import { create_live_tree_NEW } from "../create-live-tree.new.tree.hson";
import { LiveTree_NEW } from "../live-tree-class.new.tree.hson";


/**
 * Parses content and appends it as a child to each node in the current selection.
 * This method ADDS to the end of the existing content, it does not replace it.
 *
 * @param $content The content to append.
 * @returns The current LiveTree instance for chaining.
 */
export function append_NEW(this: LiveTree_NEW, $content: Partial<HsonNode_NEW> | string | LiveTree_NEW): LiveTree_NEW {
    const selectedNodes = (this as any).selectedNodes as HsonNode_NEW[];
    
    let nodesToAppend: HsonNode_NEW[];
    if (typeof $content === 'string') {
        nodesToAppend = [NEW_NEW_NODE({ _tag: STR_TAG, _content: [$content] })];
    } else if ($content instanceof LiveTree_NEW) {
        const sourceNodes = $content.sourceNode(true) as HsonNode_NEW[];
        // Use the new utility. It correctly handles the array and returns a flat array.
        nodesToAppend = unwrap_root_NEW(sourceNodes);
    } else if (is_Node_NEW($content)) {
        // Use the same utility for a single node. It will return a clean array.
        nodesToAppend = unwrap_root_NEW($content);
    } else {
        _throw_transform_err('[ERR] invalid content provided', 'append');
    }

    for (const targetNode of selectedNodes) {
        if (!targetNode._content) targetNode._content = [];

        /* find or create the _elem VSN wrapper for child nodes */
        let containerNode: HsonNode_NEW;
        const firstChild = targetNode._content[0];
        if (is_Node_NEW(firstChild) && firstChild._tag === ELEM_TAG) {
            containerNode = firstChild;
        } else {
            containerNode = NEW_NEW_NODE({ _tag: ELEM_TAG, _content: [...targetNode._content] });
            targetNode._content = [containerNode];
        }

        /* push the new nodes to the data model */
        containerNode._content.push(...nodesToAppend);

        /* appending only the new elements to the DOM to sync with data */
        const liveElement = NODE_ELEMENT_MAP_NEW.get(targetNode);
        if (liveElement) {
            for (const newNode of nodesToAppend) {
                liveElement.appendChild(create_live_tree_NEW(newNode));
            }
        }
    }
    return this;
}
