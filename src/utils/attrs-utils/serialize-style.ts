// serialize-css.utils.hson.ts

import { StyleObject } from "../../types-consts/css.types";



/**
 * converts a camelCase string to kebab-case
 * @param {string} $str "backgroundColor"
 * @returns {string} "background-color"
 */
export function camel_to_kebab($str: string): string {
  // find all uppercase letters; replace them with a hyphen and their lowercase version
  return $str.replace(/[_\s]+/g, "-")               // underscores/spaces → hyphen
    .replace(/[_\s]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/-+/g, "-")
    .toLowerCase();
}


/**
 * takes a style object and converts it back into a CSS string
 * @param $style - a Dictionary-like object of CSS properties
 * @returns {string} a browser-compatible CSS string
 */
export function serialize_style(style: StyleObject | undefined): string {
  if (!style || !Object.keys(style).length) { return ""; }

  // CHANGE: normalize entries BEFORE sorting/serializing
  const entries: Array<[string, string]> = [];
  for (const [prop, raw] of Object.entries(style)) {
    if (raw == null) continue;                       // CHANGE: skip null/undefined
    let v = String(raw).trim();                      // CHANGE: trim values
    if (!v) continue;                                // CHANGE: skip empty values
    if (v.endsWith(";")) v = v.replace(/;+$/g, "");  // CHANGE: strip any trailing semicolons
    const isCustomProp = prop.startsWith("--");
    const outKey = isCustomProp ? prop : camel_to_kebab(prop);

    entries.push([outKey, v]);
  }

  // CHANGE: sort deterministically after normalization
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  // CHANGE: no trailing semicolon; single-space after colon; single "; " between decls
  return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
}
