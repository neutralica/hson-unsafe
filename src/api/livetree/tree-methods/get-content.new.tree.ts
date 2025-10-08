// get-content.tree.ts


import { is_Node } from "../../../utils/node-guards.new.utils";
import { ELEM_TAG } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.new.types";
import { LiveTree } from "../live-tree-class.new.tree";



/**
 * Gets the child nodes of the first element in the selection.
 *
 * @returns An array of HsonNodes representing the content, or an empty array.
 */
export function getContent_NEW(this: LiveTree): HsonNode[] {
    const selectedNodes = (this as any).selectedNodes as HsonNode[];

    if (selectedNodes.length === 0) {
        return [];
    }

    const node = selectedNodes[0];
    if (!node._content) {
        return [];
    }
    /* check if the content is wrapped in an `_elem` VSNi
        if so, return the contents of the wrapper else return the content directly */
    const firstChild = node._content[0];
    if (is_Node(firstChild) && firstChild._tag === ELEM_TAG && firstChild._content) {
        return firstChild._content.filter(is_Node);
    }

    return node._content.filter(is_Node);
}

