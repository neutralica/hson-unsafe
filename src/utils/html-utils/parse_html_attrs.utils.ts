// parse_html_attrs.utils.ts


import { _DATA_INDEX, _DATA_QUID, _TRANSIT_PREFIX } from "../../types-consts/constants";
import { HsonAttrs, HsonMeta } from "../../types-consts/node.types";
import { normalize_attr_ws } from "../attrs-utils/normalize_attrs_ws.utils";
import { parse_style_string } from "../attrs-utils/parse-style.utils";


/* NEW: collect attrs + meta from an Element */
export function parse_html_attrs($el: Element): {
  attrs: HsonAttrs;
  meta?: HsonMeta;
} {
  const attrs: HsonAttrs = {};
  let meta: HsonMeta | undefined;

  // walk all DOM attributes verbatim
  for (const a of Array.from($el.attributes)) {
    const name = a.name;
    const n = name.toLowerCase();
    const v = a.value ?? "";

    // A) strip transit-only hints outright
    if (n.startsWith(_TRANSIT_PREFIX)) continue;

    // B) _meta-on-wire (reserved)
    if (n === _DATA_INDEX) { (meta ??= {})[_DATA_INDEX] = v; continue; }
    if (n === _DATA_QUID) { (meta ??= {})[_DATA_QUID] = v; continue; }

    // C) style → structured object 
    if (n === "style") { (attrs as any).style = parse_style_string(v); continue; }

    // D) ignore xmlns / xml:* noise
    if (name === "xmlns" || name.startsWith("xmlns:") || name.startsWith("xml:")) continue;

    // E) svg alias normalize
    if ($el.namespaceURI === "http://www.w3.org/2000/svg" && n === "xlink:href") {
      if (!$el.hasAttribute("href")) (attrs as any).href = v;
      continue;
    }

    // F) presence-only flags canonicalized as key="key"
    if (v === "" || v === name) { (attrs as any)[n] = name; continue; }

    // G) default: normalized user attribute
    (attrs as any)[n] = normalize_attr_ws(v);
  }

  return { attrs, meta };
}