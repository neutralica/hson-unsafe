// is-helpers.hson.util.ts

import { HsonNode, JsonType, NodeContent, Primitive } from "../types-consts/types.hson.js";
import {INDEX_TAG, VAL_TAG, STRING_TAG } from "../types-consts/constants.hson.js";

/* identifies JSON objects */
export function is_Object(x: any): x is Record<string, any> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/* identifies HSON BasicValue primitives */
export function is_Primitive(x: any): x is Primitive {
  return x === null || ["string", "number", "boolean"].includes(typeof x);
}

/* identifies HsonNode */
export function is_Node(bit: unknown): bit is HsonNode {
  return typeof bit === 'object' && bit !== null && '_tag' in bit;
}

/* for filtering out strings */
export function is_not_string(txt: JsonType) {
  return (typeof txt === 'number' ||
    txt === null ||
    typeof txt === 'boolean')
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

/* identifies nodes with no content */
export function is_void(content: NodeContent) {
  return (content.length === 0);
}