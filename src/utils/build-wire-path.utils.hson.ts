import { HsonNode_NEW } from "../new/types-consts/new.types.hson";
import { INDEX_TAG } from "../types-consts/constants.hson";
import { stringify_style } from "./stringify-style";

function is_vsn(tag: string) { return tag.startsWith("_"); }

/* build wire attrs: user _attrs + selected _meta → data-_... */
export function build_wire_attrs(n: HsonNode_NEW): Record<string, string> {
  const out: Record<string, string> = {};

  // CHANGED: only standard tags emit user _attrs (VSNs never carry _attrs on wire)
  if (!is_vsn(n._tag) && n._attrs) {
    for (const k of Object.keys(n._attrs).sort()) {
      const v = (n._attrs as any)[k];
      if (v == null) continue;
      if (k === "style" && v && typeof v === "object") {
        out[k] = stringify_style(v as Record<string, string>);
      } else {
        out[k] = String(v);
      }
    }
  }

  // meta → data-_
  const m = n._meta;
  if (m) {
    // data-quid allowed on standard tags (first-class) — include on wire
    if (!is_vsn(n._tag) && m["data-quid"] != null) out["data-_quid"] = String(m["data-quid"]);
    // data-index only on <_ii>
    if (n._tag === INDEX_TAG && m["data-index"] != null) {
      out["data-_index"] = String(m["data-index"]);
    }
  }

  return out;
}