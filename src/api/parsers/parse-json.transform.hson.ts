// parse-json.transform.hson.ts

import { to_OLD } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { parse_json_NEW } from "../../new/api/parsers/parse-json.new.transform.hson"
import { HsonNode } from "../../types-consts/node.types.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { diff_old_nodes, equal_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson";
import { parse_json_OLD } from "../../old/api/parsers/parse-json.old.transform.hson";
import { clone_node } from "../../utils/clone-node.utils.hson";
import { make_string } from "../../utils/make-string.utils.hson";


export function parse_json($json: string): HsonNode {
  console.log('parse-json wrapper reached');
  const oldNode = parse_json_OLD($json);

  if (SHADOW_ENABLED()) {
    console.log('shadow tests running - json')
    try {
      const newNodeOld = to_OLD(parse_json_NEW($json));

      // CHANGED: cloned inputs for compare only
      const a = clone_node(oldNode);
      const b = clone_node(newNodeOld);

      console.groupCollapsed('JSON tests - SHADOW_ENABLED - test results:');
      console.log(make_string(a));
      console.log(make_string(b));
      console.groupEnd();
      if (!equal_old_nodes(a, b)) {
        const diffs = diff_old_nodes(a, b, 10);
        console.warn("[shadow-json][parse] mismatch(len=%d):", $json.length, diffs);
      } else console.log('GO GO GO nodes are equal!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[shadow-json][parse] NEW crashed:", msg);
    }
  }

  return oldNode;
}