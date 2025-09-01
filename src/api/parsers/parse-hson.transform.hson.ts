import { bucket_diffs } from "../../_refactor/_refactor-utils/bucket-diffs.utils.hson";
import { diff_old_nodes, equal_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson";
import { diffNEW } from "../../_refactor/_refactor-utils/diff-new-nodes.new.utils.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { equalNEW, to_NEW, to_OLD } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { parse_hson_NEW } from "../../new/api/parsers/parse_hson.new.transform.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { parse_hson_OLD } from "../../old/api/parsers/parse-hson.old.transform.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { clone_node } from "../../utils/clone-node.utils.hson";
import { make_string } from "../../utils/make-string.utils.hson";


export function parse_hson($str: string): HsonNode {

  const oldNode = parse_hson_OLD($str); // unchanged

  if (SHADOW_ENABLED()) {

    try {
      const newNode = parse_hson_NEW($str);

      const a = clone_node(oldNode);
      const b = to_OLD(newNode);

      // ADDED: compare the new-converted nodes as well as the old-converted
      const c = to_NEW(oldNode);
      const d = clone_node(newNode)
      assert_invariants_NEW(d);
      assert_invariants_NEW(c)

      console.groupCollapsed('HSON parser tests - SHADOW_ENABLED - test results:');
      console.log(make_string(a));
      console.log(make_string(b));
      console.groupEnd();
      if (!equal_old_nodes(a, b)) {
        const diffs = diff_old_nodes(a, b, 10);
        const buckets = bucket_diffs(diffs);
        console.warn("[shadow-html][parse] OLD CLONE mismatch(len=%d): %o | top=%o",
          diffs.length, diffs.slice(0, 10), buckets);
      } else console.log('OK - old shaped nodes are equal!')
      if (!equalNEW(c, d)) {
        const diffs = diffNEW(c, d);
        console.warn("[shadow-html][parse] NEW CLONE mismatch(len=%d): %o | top=%o",
          diffs.length, diffs.slice(0, 10));
      } else console.log('OK - NEW nodes are equal!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[shadow-html][parse] NEW crashed:", msg);
    }
  }

  return oldNode;
}
