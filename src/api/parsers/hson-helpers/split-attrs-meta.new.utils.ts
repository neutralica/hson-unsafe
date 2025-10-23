import { Primitive } from "../../../types-consts";
import { _META_DATA_PREFIX } from "../../../types-consts/constants";
import { HsonAttrs, HsonMeta } from "../../../types-consts/node.new.types";
import { RawAttr } from "../../../types-consts/tokens.new.types";
import { parse_style_hard_mode } from "../../../utils/parse-css.utils";
import { unescape_hson_string } from "../../../utils/unescape-hson.utils";

// Assumptions:
// - RawAttr.value has shape { text: string; quoted?: boolean } where `quoted`
//   is true iff the HSON source used quotes (JSON string-literal grammar).
// - decode_json_string_literal(s) exists and decodes exactly once (no double-decode).
// - parse_style_hard_mode(s) returns Record<string,string>.

// Helper: decode HSON token text iff it was quoted.
function decode_hson_value(text: string, quoted: boolean | undefined): string {
  // CHANGED: single, explicit decision point
  return quoted ? unescape_hson_string(text) : text.trim();
}

export function split_attrs_meta(raw: RawAttr[]): { attrs: HsonAttrs; meta: HsonMeta } {
  const attrs: HsonAttrs = {};
  const meta:  HsonMeta  = {};

  for (const ra of raw) {
    const k: string = ra.name;

    // Route meta: ONLY data-_* goes to _meta (HSON edge — no HTML entities here)
    if (k.startsWith(_META_DATA_PREFIX)) {
      // CHANGED: decode quoted HSON once before storing
      if (ra.value) {
        const val: string = decode_hson_value(ra.value.text, ra.value.quoted);
        meta[k] = val;
      }
      // Bare meta keys are unusual; ignoring is fine.
      continue;
    }

    // style → decode (if quoted) → parse to object
    if (k === "style") {
      if (ra.value) {
        // CHANGED: decode first, then parse; keeps parity with other sources
        const decoded: string = decode_hson_value(ra.value.text, ra.value.quoted);
        attrs.style = parse_style_hard_mode(decoded);
      } else {
        attrs.style = {};
      }
      continue;
    }

    // Flags & normal values (HSON edge — JSON-literal quotes only, no HTML entities)
    if (!ra.value) {
      // Bare flag: key present with "key" (your established convention)
      attrs[k] = k as unknown as Primitive; // NOTE: keep your existing flag shape
      continue;
    }

    // CHANGED: decode quoted HSON once
    const val: string = decode_hson_value(ra.value.text, ra.value.quoted);

    // Maintain your disabled="" / disabled="disabled" → key flag behavior
    if (val === "" || val === k) {
      attrs[k] = k as unknown as Primitive;
    } else {
      attrs[k] = val as unknown as Primitive;
    }
  }

  // OPTIONAL (but recommended during debug builds):
  // Assert the Node invariant: no stray JSON escapes or HTML entities.
  // This catches missed decodes or accidental cross-edge escaping.
  if (process.env.NODE_ENV !== "production") {
    const suspicious = /\\["nrt]|&(?:quot|amp|lt|gt);/;
    for (const [ak, av] of Object.entries(attrs)) {
      if (typeof av === "string" && suspicious.test(av)) {
        console.warn(`[HSON ingest] suspicious attr value after decode: ${ak}=${JSON.stringify(av)}`);
      }
    }
    for (const [mk, mv] of Object.entries(meta)) {
      if (typeof mv === "string" && suspicious.test(mv)) {
        console.warn(`[HSON ingest] suspicious meta value after decode: ${mk}=${JSON.stringify(mv)}`);
      }
    }
  }

  return { attrs, meta };
}
