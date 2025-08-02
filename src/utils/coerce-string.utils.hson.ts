// coerce-string.hson.util.ts

import { Primitive } from "../types-consts/types.hson.js";
/**
 * parses a string value into its valueful primitive type and reports
 *   if the original string was quoted
 * @param value - Tte input string to coerce
 * @returns - an valueful value
 */
export function coerce(value: string): Primitive {
    const trimmed = value.trim();

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
            console.warn('error in coercion:', e);
            return trimmed.slice(1, -1);
        }
    }

    /* 2. check for unquoted primitive keywords */
    if (trimmed === "true") return true;
    if (trimmed === "false") return  false;
    if (trimmed === "null") return  null;

    /* 3. check for a string that is purely numeric */
    const numericRegex = /^-?\d+(\.\d+)?$/;
    if (numericRegex.test(trimmed)) {
        return Number(trimmed);
    }

    /* 4. if all else fails, it's a plain, unquoted string */
    return trimmed;
}