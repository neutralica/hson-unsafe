import { parse_style } from "../../../../utils/parse-css.utils.hson";
import { _META_DATA_PREFIX } from "../../../types-consts/constants.new.hson";
import { HsonAttrs_NEW, HsonMeta_NEW } from "../../../types-consts/node.new.types.hson";
import { RawAttr } from "../../../types-consts/tokens.new.types.hson";


/* split raw attrs into _attrs and _meta
   - flags become key:"key"
   - style parses to an object (kebab keys)
   - meta wires data-_index→'data-index', data-_quid→'data-quid'
*/
export function split_attrs_meta($raw: RawAttr[]): { _attrs: HsonAttrs_NEW; _meta: HsonMeta_NEW } {
  const _attrs: HsonAttrs_NEW = {};
  const _meta: HsonMeta_NEW = {};

  for (const ra of $raw) {
    const name = ra.name;

    /* meta mapping on wire */
    if (name.startsWith(_META_DATA_PREFIX)) { /* as of this writing, 'data-_' */
      if (ra.value) {
        const canon = 'data-' + name.slice(_META_DATA_PREFIX.length);
        _meta[canon] = String(ra.value.text);
      }
      continue; // never mirror meta keys back into _attrs
    }


    /* style parsing */
    if (name === 'style') {
      if (!ra.value) { _attrs.style = {}; continue; }
      _attrs.style = parse_style(ra.value.text);
      continue;
    }

    /* user attrs and flags */
    if (!ra.value) {
      /* bare flag → key:"key" */
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      _attrs[name] = name;
      continue;
    }

    /* keep string as-is; no number/bool coercion here */
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    _attrs[name] = ra.value.text;
  }

  return { _attrs, _meta };
}