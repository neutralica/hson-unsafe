// is-helpers.util.ts

import { II_TAG, STR_TAG, VAL_TAG } from "../../types-consts/constants";
import { BasicValue } from "../../core/types-consts/core.types";
import { is_Primitive } from "../../core/utils/guards.core.utils"
import { _DATA_INDEX } from "../../types-consts/constants";
import { HsonNode, JsonType } from "../../types-consts/node.new.types";

/* identifies HsonNode (new structure) */
export function is_Node(bit: unknown): bit is HsonNode {
  if (!bit || typeof bit !== "object") return false;

  // minimal structural check first (enables narrowing)
  const b = bit as { _tag?: unknown; _meta?: unknown };
  if (typeof b._tag !== "string") return false;

  // legacy rejection: only if _meta is an object; otherwise it's fine
  const meta = (b as any)._meta as unknown;
  if (meta && typeof meta === "object") {
    // IMPORTANT: don't assume shape; just probe keys safely
    if ("attrs" in (meta as Record<string, unknown>)) return false;
    if ("flags" in (meta as Record<string, unknown>)) return false;
  }

  return true;
}


export function is_string_NEW(txt: JsonType): txt is string {
  return (typeof txt === 'string')
}

/* identifies HsonNodes that contain a BasicValue as content */
export function is_NEW_PRIM_or_STR(node: HsonNode): boolean {
  return (
    node._content.length === 1 &&
    is_Primitive(node._content[0]) &&
    (node._tag === STR_TAG ||
      node._tag === VAL_TAG)
  )
}

/* identifies _ii index tags in an _array */
export function is_indexed_NEW(node: HsonNode): boolean {
  return (
    node._tag === II_TAG &&
    Array.isArray(node._content) &&
    node._content.length === 1 &&
    typeof node._meta?.[_DATA_INDEX] === "string"
  );
}