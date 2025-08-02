import { HsonNode, Primitive } from "../../types-consts/types.hson.js";
import { ELEM_TAG, OBJECT_TAG } from "../../types-consts/constants.hson.js";
import { is_Node } from "../is-helpers.utils.hson.js";

export function getSemanticChildren(node: HsonNode): (HsonNode | Primitive)[] {
    if (!node._content) return [];

    const firstChild = node._content[0];
    if (is_Node(firstChild) && (firstChild._tag === ELEM_TAG || firstChild._tag === OBJECT_TAG)) {
        return firstChild._content ?? [];
    }
    return node._content;
}