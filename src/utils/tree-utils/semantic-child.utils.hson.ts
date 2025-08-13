// semantic-child.utils.hson.ts

import { Primitive } from "../../core/types-consts/core.types.hson";
import { ELEM_TAG, OBJECT_TAG } from "../../types-consts/constants.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { is_Node } from "../node-guards.utils.hson";

export function getSemanticChildren(node: HsonNode): (HsonNode | Primitive)[] {
    if (!node._content) return [];

    const firstChild = node._content[0];
    if (is_Node(firstChild) && (firstChild._tag === ELEM_TAG || firstChild._tag === OBJECT_TAG)) {
        return firstChild._content ?? [];
    }
    return node._content;
}