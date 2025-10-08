// semantic-child.utils.ts

import { Primitive } from "../../../core/types-consts/core.types";
import { is_Node } from "../../../utils/node-guards.new.utils";
import { ELEM_TAG, OBJ_TAG } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.new.types";

export function get_semantic_child(node: HsonNode): (HsonNode | Primitive)[] {
    if (!node._content) return [];

    const firstChild = node._content[0];
    if (is_Node(firstChild) && (firstChild._tag === ELEM_TAG || firstChild._tag === OBJ_TAG)) {
        return firstChild._content ?? [];
    }
    return node._content;
}