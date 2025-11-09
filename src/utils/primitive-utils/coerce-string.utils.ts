// coerce-string.util.ts

import { Primitive } from "../../core/types-consts/core.types.js";
import { _throw_transform_err } from "../sys-utils/throw-transform-err.utils.js";
/**
 * parses a string value into its valueful primitive type and reports
 *   if the original string was quoted
 * @param $value - Tte input string to coerce
 * @returns - an valueful value
 */
export function coerce($value: string): Primitive {
    const trimmed = $value.trim();
    if (trimmed === '') {
        return '';
    }
    /* 1. check for a quoted string literal first */
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        try {
            /*  it was explicitly a string; the parsed value is the content */
            return JSON.parse(trimmed);
        } catch (e) {
            /*  malformed, treat as a plain string of its inner content */
            const msg = e instanceof Error ? e.message : e;
            _throw_transform_err(`error in coercion: ${msg}`, 'coerce', $value)
        }
    }
    /* 2. check for unquoted primitive keywords */
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;

    /* 3. check for a string that is purely numeric */

  
    const numericRegex = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    if (numericRegex.test(trimmed)) {
        return Number(trimmed);
    }

    /* 4. if all else fails, it's a plain, unquoted string */
    return trimmed;
}