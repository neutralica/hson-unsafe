// semantic-child.utils.hson.ts

import { Primitive } from "../../../core/types-consts/core.types.hson";
import { is_Node_NEW } from "../../../utils/node-guards.new.utils.hson";
import { ELEM_TAG, OBJ_TAG } from "../../../types-consts/constants.hson";
import { HsonNode_NEW } from "../../../types-consts/node.new.types.hson";

export function get_semantic_child(node: HsonNode_NEW): (HsonNode_NEW | Primitive)[] {
    if (!node._content) return [];

    const firstChild = node._content[0];
    if (is_Node_NEW(firstChild) && (firstChild._tag === ELEM_TAG || firstChild._tag === OBJ_TAG)) {
        return firstChild._content ?? [];
    }
    return node._content;
}