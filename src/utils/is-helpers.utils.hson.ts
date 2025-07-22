// is-helpers.hson.util.ts

import { parse_tokens } from "../api/parsers/parse-tokens.transform.hson.js";
import { tokenize_hson } from "../api/parsers/tokenize-hson.transform.hson.js";
import { HsonNode, JSONShape, NodeContent, BasicValue } from "../types-consts/base.types.hson.js";
import {INDEX_TAG, PRIM_TAG, STRING_TAG } from "../types-consts/constants.types.hson.js";
import { close_tag_lookahead } from "./close-tag-lookahead.utils.hson.js";

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


/**
 * checks if a string is a valid, parsable json object or array
 * @returns {boolean}
 */
export function is_valid_json(text: string): boolean {
  const trimmedText = text.trim();

  if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
    return false;
  }

  try {
    JSON.parse(trimmedText);
    console.log("true!")
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * performs a multi-step, stricter check to validate an HSON string
 * @returns {boolean}
 */
export function is_valid_hson(text: string): boolean {
  if (!text.includes('<')) { return false; }

  // if (
  //   !text.includes('<') &&
  //   isNaN(Number(text)) &&
  //   !['true', 'false', 'null'].includes(text.trim()) &&
  //   !text.trim().startsWith('"')
  // ) {
  //   return false;
  // }
  
  try {
    
    const tokens = tokenize_hson(text, 0);
    parse_tokens(tokens);
    
    return true;
  } catch (e) {
    
    return false;
  }
}

/**
 * checks if a string contains html-like tag structures
 * this is a heuristic, not a full validation
 * @returns {boolean}
 */
export function is_valid_html(text: string): boolean {
  // a simple regex to check for the presence of <tag> or </tag>
  // this is enough to distinguish it from plain text for our purposes
  
  if (!text.includes('<') || !text.includes('>')|| !text.includes('/')) {
    return false;
  }

  return /<[a-z][\s\S]*>/i.test(text);
}
