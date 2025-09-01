/* src/api/parsers/parse-html.transform.hson.ts */

import type { HsonNode } from "../../types-consts/node.types.hson.js";
import { parse_html_OLD } from "../../old/api/parsers/parse-html.old.transform.hson.js";
import { parse_html_NEW } from "../../new/api/parsers/parse-html.new.transform.hson.js";
import { equal_old_nodes, diff_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson.js";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson.js";
import { to_NEW, to_OLD } from "../../_refactor/kompat/kompat-layer.refactor.hson.js";
import { clone_node } from "../../utils/clone-node.utils.hson.js";
import { sanitize_for_xml } from "../../utils/html-filtration.utils.hson.js";
import { bucket_diffs } from "../../_refactor/_refactor-utils/bucket-diffs.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson.js";

/* stable entry: returns OLD; NEW is only used for parity checks */
export function parse_html($html: string): HsonNode {
  const sanitized = sanitize_for_xml($html); // ← added

  const oldNode = parse_html_OLD(sanitized); // unchanged

  if (SHADOW_ENABLED()) {
    console.log('shadow tests running - html')
    try {
      const newNode = parse_html_NEW($html);
      const newNodeOld = to_OLD(newNode);

      const a = clone_node(oldNode);
      const b = clone_node(newNodeOld);
      const c = clone_node(newNode)
      const d = to_NEW(oldNode);

      assert_invariants_NEW(c);
      assert_invariants_NEW(d);


      console.groupCollapsed('HTML tests - SHADOW_ENABLED - test results:');
      console.log(make_string(a));
      console.log(make_string(b));
      console.groupEnd();
      if (!equal_old_nodes(a, b)) {
        const diffs = diff_old_nodes(a, b, 10);
        const buckets = bucket_diffs(diffs);
        console.warn("[shadow-html][parse] mismatch(len=%d): %o | top=%o",
          diffs.length, diffs.slice(0, 10), buckets);
      } else console.log('OK - nodes are equal!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[shadow-html][parse] NEW crashed:", msg);
    }
  }

  return oldNode;
}
