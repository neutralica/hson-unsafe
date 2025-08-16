/* src/api/parsers/parse-html.transform.hson.ts */

import type { HsonNode } from "../../types-consts/node.types.hson.js";
import {  parse_html_OLD } from "../../old/api/parsers/parse-html.old.transform.hson.js";
import {  parse_html_NEW } from "../../new/api/parsers/parse-html.new.transform.hson.js";
import { equal_old_nodes, diff_old_nodes } from "../../_refactor/_refactor-utils/compare-nodes.utils.hson.js";
import { SHADOW_JSON } from "../../_refactor/flags/flags.refactor.hson.js";
import { toOLD } from "../../_refactor/kompat/kompat-layer.refactor.hson.js";

/* stable entry: returns OLD; NEW is only used for parity checks */
export function parse_html($src: string): HsonNode {
  const oldNode = parse_html_OLD($src);

  if (SHADOW_JSON) {
    try {
      const newNodeOld = toOLD(parse_html_NEW($src));
        if (!equal_old_nodes(oldNode, newNodeOld)) {
            console.warn("[shadow-html][parse] mismatch:", diff_old_nodes(oldNode, newNodeOld, 10));
        } else return newNodeOld;
    } catch (e: any) {
      console.warn("[shadow-html][parse] NEW crashed:", e.message);
    }
  }

  return oldNode;
}
