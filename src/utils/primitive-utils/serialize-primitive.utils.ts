// serialize-primitive.utils.ts

import { Primitive } from "../../types-consts/core.types";
/**
 * serializes a BasicValue type into its string representation
 *
 * handles two cases:
 * - for strings, it uses `json.stringify()` to ensure the value is correctly
 * wrapped in quotes and that any internal special characters are escaped.
 * - for numbers, booleans, and null, it returns their direct literal string value.
 *
 * @param {Primitive} $prim - the primitive value to serialize.
 * @returns {string} the serialized string representation of the primitive.
 */

export function serialize_primitive($prim: Primitive): string {

  /* if the primitive is a string, just serialize it as a string. */
    if (typeof $prim === 'string') {
      return JSON.stringify($prim);
    }
  
    /* if it's bool/num/null, serialize it as a raw literal */
    return String($prim);
  }

