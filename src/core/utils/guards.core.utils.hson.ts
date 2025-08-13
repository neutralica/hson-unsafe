// is-helpers.hson.util.ts

import { BasicValue, JsonType,  JsonObj,  Primitive } from "../types-consts/core.types.hson.js";

/* identifies JSON objects */
export function is_Object(x: any): x is JsonObj {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/* identifies HSON BasicValue primitives */
export function is_Primitive(x: any): x is Primitive {
  return x === null || ["string", "number", "boolean"].includes(typeof x);
}


/* for filtering out strings */
export function is_not_string(txt: JsonType): txt is BasicValue {
  return (typeof txt === 'number' ||
    txt === null ||
    typeof txt === 'boolean')
}

export function is_string(txt: JsonType): txt is string {
  return (typeof txt === 'string')
}

/* identifies nodes with no content */
export function is_void(content: readonly unknown[]) {
  return (content.length === 0);
}

const hasOwn = (o: object, k: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(o, k);

export function is_plain_object(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}