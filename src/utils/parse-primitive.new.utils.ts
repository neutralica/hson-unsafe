// src/utils/parse-primitive.new.utils.ts

import { Primitive } from "../core/types-consts/core.types";
import { STR_TAG, VAL_TAG } from "../types-consts/constants";

export function parse_primitive(p: Primitive) {
  const tag = (typeof p === "string") ? STR_TAG : VAL_TAG; // e.g. "_str" | "_val"
  return { _tag: tag, _attrs: {}, _meta: {}, _content: [p] };
}