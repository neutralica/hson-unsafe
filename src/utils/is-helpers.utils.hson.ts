// is-helpers.hson.util.ts

import { HsonNode, JSONShape, NodeContent, BasicValue } from "../types-consts/base.types.hson.js";
import {INDEX_TAG, PRIM_TAG, STRING_TAG } from "../types-consts/base.const.hson.js";

/* identifies JSON objects */
export function is_Object(x: any): x is Record<string, any> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/* identifies HSON BasicValue primitives */
export function is_BasicValue(x: any): x is BasicValue {
  return x === null || ["string", "number", "boolean"].includes(typeof x);
}

/* identifies HsonNode */
export function is_Node(bit: unknown): bit is HsonNode {
  return typeof bit === 'object' && bit !== null && 'tag' in bit;
}

/* for filtering out strings */
export function is_not_string(txt: JSONShape) {
  return (typeof txt === 'number' ||
    txt === null ||
    typeof txt === 'boolean')
}

/* identifies HsonNodes that contain a BasicValue as content */
export function is_PRIM_or_STR_Node(node: HsonNode): boolean {
  return (
    node.content.length === 1 &&
    is_BasicValue(node.content[0]) &&
    (node.tag === STRING_TAG ||
      node.tag === PRIM_TAG)
  )
}

/* identifies _ii index tags in an _array */
export function is_indexed(node: HsonNode): boolean {
  return (
    node.tag === INDEX_TAG && node.content && node.content.length === 1
  )
}

/* identifies nodes with no content */
export function is_void(content: NodeContent) {
  return (content.length === 0);
}