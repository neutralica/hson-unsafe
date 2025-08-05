// unwrap-root.utils.hson.ts

import { ELEM_TAG, ROOT_TAG } from "../types-consts/constants.hson";
import { HsonNode } from "../types-consts/types.hson";
import { is_Node } from "./is-helpers.utils.hson";
import { _throw_transform_err } from "./throw-transform-err.utils.hson";

/**
 * takes one or more HsonNodes and pops them out of <_root<_elem< structure
 * @param $content the HsonNode or array of HsonNodes to unwrap
 * @returns a clean array of the actual content nodes sans _root or _elem
 */
export function unwrap_root($content: HsonNode): HsonNode {
    if ($content._tag === ROOT_TAG) {
        const childNode = $content._content?.[0];
        if (!is_Node(childNode) || childNode._tag !== ELEM_TAG) {
            _throw_transform_err('Malformed _root node', 'unwrap', $content);
        }

        const contentNodes = childNode._content?.filter(is_Node) || [];
        if (contentNodes.length !== 1) {
            _throw_transform_err(
                `Expected 1 content node, but found ${contentNodes.length}.`,
                'unwrap',
                $content
            );
        }
        return contentNodes[0];
    }
    // If it's not a _root, it's already the single node we want.
    return $content;
}