/* src/api/parsers/parse-html.transform.hson.ts */

import type { HsonNode } from "../../types-consts/node.types.hson.js";
import { parse_html_OLD } from "../../old/api/parsers/parse-html.old.transform.hson.js";
import { parse_html_NEW } from "../../new/api/parsers/parse-html.new.transform.hson.js";
import { equal_old_nodes, diff_old_nodes } from "../../_refactor/_refactor-utils/compare-nodes.utils.hson.js";
import { SHADOW_ENABLED, SHADOW_TEST } from "../../_refactor/flags/flags.refactor.hson.js";
import { toOLD } from "../../_refactor/kompat/kompat-layer.refactor.hson.js";
import { clone_node } from "../../utils/clone-node.utils.hson.js";

/* stable entry: returns OLD; NEW is only used for parity checks */
export function parse_html($src: string): HsonNode {
  const oldNode = parse_html_OLD($src);
if (oldNode) console.log('>>> old HTML path successful')
  if (SHADOW_ENABLED()) {
    console.log('shadow tests running - html')
    try {
      const newNodeOld = toOLD(parse_html_NEW($src));

      const a = clone_node(oldNode);
      const b = clone_node(newNodeOld);

      if (!equal_old_nodes(a, b)) {
        const diffs = diff_old_nodes(a, b, 10);
        console.warn("[shadow-html][parse] mismatch(len=%d):", $src.length, diffs);
      } else console.log('OK OK OK nodes are equal!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[shadow-html][parse] NEW crashed:", msg);
    }
  }

  return oldNode;
}
