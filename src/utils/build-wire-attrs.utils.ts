

import { _META_DATA_PREFIX } from "../types-consts/constants";
import { HsonNode } from "../types-consts/node.new.types";
import { serialize_style } from "./serialize-css.utils";

/* build wire attrs: user _attrs + selected _meta → data-_... */
export function build_wire_attrs(n: HsonNode): Record<string, string> {
  const out: Record<string, string> = {};

  // 1) user attrs (primitives only; style handled elsewhere if you have it)
  const a = n._attrs;
  if (a) {
    for (const [k, v] of Object.entries(a)) {
      // CHANGED: handle style instead of skipping it
      if (k === "style") {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          // CHANGED: object → CSS text
          out.style = serialize_style(v as Record<string, string>);
        } else if (typeof v === "string") {
          // CHANGED: already a CSS string; pass through
          out.style = v;
        }
        continue; // CHANGED: done with style
      }

      // unchanged: primitives/other attrs
      out[k] = String(v as any);
    }
  }

  // 2) meta: only keys that start with 'data-_', keep EXACT key
  const m = n._meta;
  if (m) {
    for (const [k, v] of Object.entries(m)) {
      if (k.startsWith(_META_DATA_PREFIX)) out[k] = String(v);
    }
  }

  return out;
}