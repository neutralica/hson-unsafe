// is-helpers.hson.util.ts

import { is_Primitive } from "../core/utils/guards.core.utils.hson.js";
import { INDEX_TAG, VAL_TAG, STRING_TAG } from "../types-consts/constants.hson.js";
import { HsonMeta, HsonNode } from "../types-consts/node.types.hson.js";


/* identifies HsonNode */
export function is_Node(bit: unknown): bit is HsonNode {
  return typeof bit === 'object' && bit !== null && '_tag' in bit;
}

/* identifies HsonNodes that contain a BasicValue as content */
export function is_PRIM_or_STR_Node(node: HsonNode): boolean {
  return (
    node._content.length === 1 &&
    is_Primitive(node._content[0]) &&
    (node._tag === STRING_TAG ||
      node._tag === VAL_TAG)
  )
}

/* identifies _ii index tags in an _array */
export function is_indexed(node: HsonNode): boolean {
  return (
    node._tag === INDEX_TAG && node._content && node._content.length === 1
  )
}

export function has_OldMeta(o: unknown): o is { _meta?: HsonMeta } {
  return !!o && typeof o === "object" && "_meta" in (o as any);
}