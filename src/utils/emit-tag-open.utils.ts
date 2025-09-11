// emit-tag-open.utils.ts


import { HsonNode } from "../types-consts/node.new.types";
import { build_wire_attrs } from "./build-wire-attrs.utils";
import { escape_attrs } from "./escape_attrs.utils";

function emit_tag_open(n: HsonNode): string {
  const tag = n._tag;                 // you still unwrap _elem elsewhere
  const attrs = build_wire_attrs(n);

  const parts: string[] = [];
  for (const k of Object.keys(attrs).sort()) {
    const v = attrs[k];
    // flags are key="key" in-memory → bare key on HTML wire
    parts.push(v === k ? k : `${k}="${escape_attrs(v)}"`);
  }

  return parts.length ? `<${tag} ${parts.join(" ")}>` : `<${tag}>`;
}
