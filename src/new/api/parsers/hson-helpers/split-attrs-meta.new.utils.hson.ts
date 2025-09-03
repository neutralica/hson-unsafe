import { parse_style } from "../../../../utils/parse-css.utils.hson";
import { _META_DATA_PREFIX } from "../../../types-consts/constants.new.hson";
import { HsonAttrs_NEW, HsonMeta_NEW } from "../../../types-consts/node.new.types.hson";
import { RawAttr } from "../../../types-consts/tokens.new.types.hson";


/* split raw attrs into _attrs and _meta
   - flags become key:"key"
   - style parses to an object (kebab keys)
   - meta wires data-_index, data-_quid (for now)
*/
export function split_attrs_meta(raw: RawAttr[]): { attrs: HsonAttrs_NEW; meta: HsonMeta_NEW } {
  const attrs: HsonAttrs_NEW = {};
  const meta:  HsonMeta_NEW  = {};

  for (const ra of raw) {
    const k = ra.name;

    // Route meta: ONLY data-_* goes to _meta
    if (k.startsWith(_META_DATA_PREFIX)) {
      if (ra.value) {
        meta[k] = String(ra.value.text);     // keep as 'data-_…' to match serializer
      }
      // else: bare meta keys are unusual; either ignore or set to ""
      continue;
    }

    // style: parse to object (you already do this)
    if (k === "style") {
      attrs.style = ra.value ? parse_style(ra.value.text) : {};
      continue;
    }

    // flags & normal values
    if (!ra.value) { attrs[k] = k as any; continue; }     // bare flag → key:"key"
    const v = ra.value.text;
    if (v === "" || v === k) { attrs[k] = k as any; }     // disabled="" or disabled="disabled"
    else { attrs[k] = v as any; }
  }

  return { attrs, meta };
}