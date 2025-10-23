// // format-hson.attrs.utils.ts

// import { Primitive } from "../core/types-consts/core.types.js";
// import { HsonAttrs } from "../types-consts/node.new.types.js";
// import { serialize_style } from "./serialize-css.utils.js";

// /**
//  * serializes an attrs object into a single string of hson attributes. 
//  * handles several cases:
//  * - the special 'style' attribute, serialized from an object into a css string
//  * - boolean flags, which are rendered as just the key (e.g., ` disabled`)
//  * - string values, which are quoted and have internal quotes escaped
//  * - other primitive values, which are rendered as key=value
//  *
//  * @param {HsonMeta_NEW} attrs the attribute object to format
//  * @returns {string} a single string of all formatted hson attributes, ready for injection into a tag
//  */

// // hson-escape: for HSON (JSON-like) quoting, not HTML entities.
// // Escapes: \  "  \n  \t  \r  (leave other chars alone)
// function escape_hson_attr_value(input: string): string {
//   let out: string = "";
//   for (let i: number = 0; i < input.length; i++) {
//     const ch: string = input[i]!;
//     if (ch === "\\") { out += "\\\\"; continue; }
//     if (ch === "\"") { out += "\\\""; continue; }
//     if (ch === "\n") { out += "\\n";  continue; }
//     if (ch === "\t") { out += "\\t";  continue; }
//     if (ch === "\r") { out += "\\r";  continue; }
//     out += ch;
//   }
//   return out;
// }

// // NOTE: HTML vs HSON separation:
// // - HTML emit should use entity-escaping (&quot; &amp; &lt;).
// // - HSON emit uses backslash escapes (this file).

// export function format_hson_attrs(attrs: HsonAttrs): string {
//   const parts: string[] = [];

//   for (const [key, value] of Object.entries(attrs)) {
//     // 1) style — prefer canonical object → CSS; fallback to string (but still escaped)
//     if (key === "style") {
//       if (value && typeof value === "object" && !Array.isArray(value)) {
//         const cssText: string = serialize_style(value as Record<string, string>);
//         parts.push(` style="${escape_hson_attr_value(cssText)}"`);
//       } else if (typeof value === "string") {
//         // permissive fallback, but deterministic: escape for HSON
//         parts.push(` style="${escape_hson_attr_value(value)}"`);
//       }
//       // if style is null/undefined, emit nothing
//       continue;
//     }

//     // 2) flags (disabled, checked, etc.)
//     //    Convention: bare flag → ` disabled` ; also handle disabled="" / disabled="disabled"
//     if (value === undefined || value === null) { continue; }
//     const valueStr: string = String(value);

//     if (key === valueStr || valueStr === "") {
//       parts.push(` ${key}`);
//       continue;
//     }

//     // 3) primitives
//     if (typeof value === "string") {
//       // HSON string → quoted, JSON-like escapes (not HTML entities)
//       const escaped: string = escape_hson_attr_value(value);
//       parts.push(` ${key}="${escaped}"`);
//       continue;
//     }

//     // numbers/booleans/null: unquoted
//     parts.push(` ${key}=${valueStr}`);
//   }

//   return parts.join("");
// }
