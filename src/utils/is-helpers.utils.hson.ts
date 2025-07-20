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
 * Checks if a string is valid, parsable JSON.
 * @returns {boolean}
 */
export function is_valid_json(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch (e) {
    return false;
  }
}

// --- new helper function to check for balanced delimiters ---
function areDelimitersBalanced(text: string): boolean {
  const stack: string[] = [];
  const map: { [key: string]: string } = {
    '(': ')',
    '[': ']',
    '{': '}',
    '«': '»',
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (map[char]) {
      stack.push(char);
    } else if (Object.values(map).includes(char)) {
      const lastOpen = stack.pop();

      if (!lastOpen || map[lastOpen] !== char) {
        return false;
      }
    }
  }
  return stack.length === 0;
}

/**
 * performs a multi-step, stricter check to validate an HSON string
 * @returns {boolean}
 */
export function is_valid_hson(text: string): boolean {
  try {
    // 1. quick sanity check: must contain tag-like structures if not a simple primitive
    if (!text.includes('<') && isNaN(Number(text)) && !['true', 'false', 'null'].includes(text) && !text.startsWith('"')) {
        return false;
    }
    
    // 2. check for balanced brackets and guillemets
    if (!areDelimitersBalanced(text)) {
      return false;
    }

    // 3. leverage close_tag_lookahead (your idea)
    // find the first block and ensure it closes properly
    const lines = text.split('\n');
    const firstTagIndex = lines.findIndex(line => line.trim().startsWith('<'));

    if (firstTagIndex !== -1) {
      const line = lines[firstTagIndex].trim();
      // extract tag name for the lookahead function
      const tagName = line.substring(1).split(/[\s>]/)[0];
      close_tag_lookahead(lines, firstTagIndex, tagName);
    }

    // 4. if all else passes, do a final full parse
    const tokens = tokenize_hson(text);
    parse_tokens(tokens);

    return true; // if we get here without any errors, it's valid
  } catch (e) {
    // if any step above throws an error, it's invalid
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
  return /<[a-z][\s\S]*>/i.test(text);
}
