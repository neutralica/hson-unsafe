// append.tree.hson.ts

import { ELEM_TAG, NEW_NODE, NODE_ELEMENT_MAP, ROOT_TAG, STRING_TAG } from "../../../types-consts/constants.hson.js";
import { HsonNode } from "../../../types-consts/types.hson.js";
import { is_Node } from "../../../utils/is-helpers.utils.hson.js";
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

    // /* check for  _root*/
    // const unwrappest = (node: HsonNode) => {
    //    const nodes = Array.isArray($content) ? $content : [$content];
    //     let finalNodes: HsonNode[] = [];

    //     for (const node of nodes) {
    //         if (node._tag === ROOT_TAG) {
    //             const childNode = node._content?.[0];
    //             if (is_Node(childNode) && childNode._tag === ELEM_TAG) {
    //                 // It's a valid container, so add its children to our list.
    //                 finalNodes.push(...(childNode._content?.filter(is_Node) || []));
    //             } else {
    //                 // It's a malformed _root, so just append the _root itself.
    //                 finalNodes.push(node);
    //             }
    //         } else {
    //             // It's not a _root, so just add the node directly.
    //             finalNodes.push(node);
    //         }
    //     }
    //     return finalNodes;
    // };

    let nodesToAppend: HsonNode[];
    if (typeof $content === 'string') {
        nodesToAppend = [NEW_NODE({ _tag: STRING_TAG, _content: [$content] })];
    } else if ($content instanceof LiveTree) {
        const sourceNodes = $content.sourceNode(true) as HsonNode[];
         nodesToAppend = sourceNodes.flatMap(unwrap_root);
    } else if (is_Node($content)) {
        nodesToAppend = [unwrap_root($content)];
    } else {
        _throw_transform_err('[ERR] invalid content provided', 'append', $content);
        return this; // Unreachable, but satisfies TypeScript
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
