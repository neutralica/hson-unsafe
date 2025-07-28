import { HsonNode, BasicValue } from "../../types-consts/base.types.hson.js";
import { ELEM_TAG, OBJECT_TAG } from "../../types-consts/base.const.hson.js";
import { is_Node } from "../is-helpers.utils.hson.js";

export function getSemanticChildren(node: HsonNode): (HsonNode | BasicValue)[] {
    if (!node.content) return [];

    const firstChild = node.content[0];
    if (is_Node(firstChild) && (firstChild.tag === ELEM_TAG || firstChild.tag === OBJECT_TAG)) {
        return firstChild.content ?? [];
    }
    return node.content;
}