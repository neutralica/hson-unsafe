// src/api/serializers/serialize-html.render.hson.ts 

import { equal_old_nodes, diff_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { to_NEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { serialize_html_NEW } from "../../new/api/serializers/serialize-html.new.render.hson";
import { parse_html_OLD } from "../../old/api/parsers/parse-html.old.transform.hson";
import { serialize_html_OLD } from "../../old/api/serializers/serialize-html.old.render.hson";
import { HsonNode } from "../../types-consts/node.types.hson";

/* stable entry: returns OLD; parity by reparsing both strings through OLD parser */
export function serialize_html($node: HsonNode): string {
console.log('serializing html - beginning')
  const oldStr = serialize_html_OLD($node);

  if (SHADOW_ENABLED()) {
    try {
      const newStr = serialize_html_NEW(to_NEW($node));
      /* normalize whitespace/attribute order by reparsing both with the same parser */
      const A = parse_html_OLD(oldStr);
      const B = parse_html_OLD(newStr);
      if (!equal_old_nodes(A, B)) {
        console.warn("[shadow-html][serialize] mismatch:", diff_old_nodes(A, B, 10));
      } else console.log('SUCCESS! both new and old node paths match')
    } catch (e: any) {
      console.warn("[shadow-html][serialize] NEW crashed:", e.message);
    }
  }

  return oldStr;
}