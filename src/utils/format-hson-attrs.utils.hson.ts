// format-hson.attrs.utils.hson.ts

import { HsonAttrs, Primitive } from "../types-consts/types.hson.js";
import { serialize_css } from "./serialize-css.utils.hson.js";

/**
 * serializes an attrs object into a single string of hson attributes. 
 * handles several cases:
 * - the special 'style' attribute, serialized from an object into a css string
 * - boolean flags, which are rendered as just the key (e.g., ` disabled`)
 * - string values, which are quoted and have internal quotes escaped
 * - other primitive values, which are rendered as key=value
 *
 * @param {HsonAttrs} attrs the attribute object to format
 * @returns {string} a single string of all formatted hson attributes, ready for injection into a tag
 */

export function format_hson_attrs(attrs: HsonAttrs): string {
  const attrsFormatted = Object.entries(attrs)
    .map(([key, value]) => {

      /* 'style' object will come parsed (if valid CSS, else returned as string)*/
      if (key === 'style') {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        /* serialize the object to a CSS string */
          const cssString = serialize_css(value as Record<string, string>);
          /* format for HSON, ensuring the CSS string is quoted */
          return ` style="${cssString}"`;
        }
        /* if style is not a valid CSS object, just return the string as-is */
        return ` style="${value}"`;
      }

      /* for all other primitive attributes */
      const primitiveValue = value as Primitive;

      /* handle flags (disabled="disabled") */
      if (key === String(primitiveValue)) {
        return ` ${key}`;
      }

      /* string-valued attrs need quotes */
      if (typeof primitiveValue === 'string') {
        /* escape any double quotes inside the string itself & wrap */
        const escapedValue = primitiveValue.replace(/"/g, '\\"');
        return ` ${key}="${escapedValue}"`;
      }

      /* fallback: other Primitive */
      return ` ${key}=${primitiveValue}`;
    })

    /* (remove any empty strings from ignored attributes) */
    .filter(Boolean)
    .join("");

  return attrsFormatted;
}
