// parse-css.utils.ts

import { kebab_to_camel } from "./kebab-to-camel.util";
import { _throw_transform_err } from "./throw-transform-err.utils";

/* debug log */
let _VERBOSE = true;
const STYLE = 'color:grey;font-weight:600;padding:1px 3px;border-radius:4px';
// tweak _log to style every arg (incl. your prefix), no helpers:
const _log = _VERBOSE
  ? (...args: unknown[]) =>
    console.log(
      ['%c%s', ...args.map(() => '%c%o')].join(' '),
      STYLE, '[parse_style] →',
      ...args.flatMap(a => [STYLE, a]),
    )
  : () => { };

/** Parse a CSS declaration list safely (handles quotes/parentheses). */
export function parse_style_string(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;

  let buf = "";
  let inQuotes = false;
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;

  const flushDecl = () => {
    const s = buf.trim();
    buf = "";
    if (!s) return;

    // split on first ":" outside quotes/parentheses
    let i = 0, k = -1;
    let q = null as '"' | "'" | null;
    let dq = false, depth = 0;
    while (i < s.length) {
      const ch = s[i]!;
      if (q) { if (ch === q) q = null; i++; continue; }
      if (ch === '"' || ch === "'") { q = ch as '"' | "'"; i++; continue; }
      if (ch === "(") { depth++; i++; continue; }
      if (ch === ")") { if (depth) depth--; i++; continue; }
      if (ch === ":" && depth === 0) { k = i; break; }
      i++;
    }
    if (k === -1) return;

    const rawKey = s.slice(0, k).trim();
    const rawVal = s.slice(k + 1).trim();
    if (!rawKey) return;

    const isCustomProp = rawKey.startsWith("--");
    const key = isCustomProp
      ? rawKey // preserve verbatim for custom properties
      : kebab_to_camel(rawKey.toLowerCase()); // normal props: lower → camel

    const val = rawVal.trim();
    out[key] = val;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === quote) { inQuotes = false; quote = null; }
      buf += ch; continue;
    }
    if (ch === '"' || ch === "'") { inQuotes = true; quote = ch as any; buf += ch; continue; }
    if (ch === "(") { parenDepth++; buf += ch; continue; }
    if (ch === ")") { if (parenDepth) parenDepth--; buf += ch; continue; }
    if (ch === ";" && parenDepth === 0) { flushDecl(); continue; }
    buf += ch;
  }
  flushDecl();

  return out;
}



// /**
//  * Parses a CSS style string into a camelCased JavaScript object.
//  * @param {string} $text - e.g., "color: blue; font-weight: bold;"
//  * @returns {Record<string, string>} - e.g., { color: 'blue', fontWeight: 'bold' }
//  */
// export function parse_style_basic($text: string): string | Record<string, string> {
//   try {
//     if (!$text) {
//       console.warn('no text received');
//       return {};
//     }

//     const styleObject: Record<string, string> = {};

//     /* 1. split the string into individual "key: value" declarations */
//     const declarations = $text.split(';');

//     for (const declaration of declarations) {
//       /* skip empty parts from trim */
//       if (!declaration.trim()) {
//         continue;
//       }

//       /* 2. get key, value */
//       const [property, ...valueParts] = declaration.split(':');
//       const value = valueParts.join(':').trim();

//       if (property && value) {
//         const propTrimmed = property.trim();

//         /* kebab-case to camelCase conversion */
//         const camelCaseProp = propTrimmed.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());

//         styleObject[camelCaseProp] = value;
//       }
//     }

//     const sortStyleObj: Record<string, string> = {};
//     Object.keys(styleObject)
//       .sort()
//       .forEach(key => {
//         sortStyleObj[key] = styleObject[key];
//       });

//     return sortStyleObj;
//   } catch (e) {
//     _throw_transform_err('[HSON WARN parse-css.util.ts -- error parsing CSS style string] ', 'parse_css_attrs', $text);
//   }
// }

