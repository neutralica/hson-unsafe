// parse_html_attrs.utils.ts


import { _DATA_INDEX, _DATA_QUID } from "../types-consts/constants";
import { HsonAttrs_NEW, HsonMeta_NEW } from "../types-consts/node.new.types";
import { parse_style_hard_mode } from "./parse-css.utils";


/* NEW: collect attrs + meta from an Element */
export function parse_html_attrs($el: Element): {
  attrs: HsonAttrs_NEW;
  meta?: HsonMeta_NEW;
} {
  const attrs: HsonAttrs_NEW = {};
  let meta: HsonMeta_NEW | undefined;

  // walk all DOM attributes verbatim
  for (const a of Array.from($el.attributes)) {
    const name = a.name;              // keep original case for value, but
    const n = name.toLowerCase();     // compare in lowercase
    const v = a.value ?? "";

    // 1) system meta on wire: data-_{index,quid} → _meta
    if (n === _DATA_INDEX) {
      (meta ??= {})[_DATA_INDEX] = v;
      continue;
    }
    if (n === _DATA_QUID) {
      (meta ??= {})[_DATA_QUID] = v;
      continue;
    }

    // 2) style → structured object (your rule: parse to object in-memory)
    if (n === "style") {
      // parse_css_attrs returns {} | Record<string,string>
      (attrs as any).style = parse_style_hard_mode(v);
      continue;
    }

    // 3) boolean-ish HTML flags canonicalized as key="key"
    //    presence-only or empty string → "key"
    if (v === "" || v === name) {
      (attrs as any)[n] = name; // canonical: key="key"
      continue;
    }

    // 4) everything else: literal string
    (attrs as any)[n] = v;
  }

  return { attrs, meta };
}