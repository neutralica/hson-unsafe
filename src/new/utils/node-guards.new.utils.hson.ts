// is-helpers.hson.util.ts

import { II_TAG, STR_TAG, VAL_TAG } from "../../types-consts/constants.hson";
import { BasicValue } from "../../core/types-consts/core.types.hson";
import { HsonMeta_NEW, HsonNode_NEW, JsonType_NEW, NodeContent_NEW } from "../types-consts/node.new.types.hson";
import { is_Primitive } from "../../core/utils/guards.core.utils.hson"

/* identifies HsonNode (new structure) */
export function is_Node_NEW(bit: unknown): bit is HsonNode_NEW {
  return typeof bit === 'object' &&
    bit !== null &&
    '_tag' in bit &&
    '_meta' in bit &&
    !('attrs' in (bit._meta as HsonMeta_NEW)) &&
    !('flags' in (bit._meta as HsonMeta_NEW));
}

export function is_not_string_NEW(txt: JsonType_NEW): txt is BasicValue {
  return (typeof txt === 'number' ||
    txt === null ||
    typeof txt === 'boolean')
}


export function is_string_NEW(txt: JsonType_NEW): txt is string {
  return (typeof txt === 'string')
}

/* identifies HsonNodes that contain a BasicValue as content */
export function is_NEW_PRIM_or_STR(node: HsonNode_NEW): boolean {
  return (
    node._content.length === 1 &&
    is_Primitive(node._content[0]) &&
    (node._tag === STR_TAG ||
      node._tag === VAL_TAG)
  )
}

/* identifies _ii index tags in an _array */
export function is_indexed_NEW(node: HsonNode_NEW): boolean {
  return (
    node._tag === II_TAG && node._content && node._content.length === 1
  )
}
