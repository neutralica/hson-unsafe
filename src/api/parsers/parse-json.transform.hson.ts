// parse-json.transform.hson.ts

import { toOLD } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import {parse_json_NEW} from "../../new/api/parsers/parse-json.new.transform.hson"
import { HsonNode } from "../../types-consts/node.types.hson";
import { SHADOW_JSON } from "../../_refactor/flags/flags.refactor.hson";
import { diff_old_nodes, equal_old_nodes } from "../../_refactor/_refactor-utils/compare-nodes.utils.hson";
export function parse_json($json: string): HsonNode {
    const oldNode = parse_json($json);

  if (SHADOW_JSON) {
    try {
      const newNodeNew = parse_json_NEW($json);        // ✅ call NEW parser
      const newNodeOld = toOLD(newNodeNew);            // ✅ convert NEW -> OLD
      const equal = equal_old_nodes(oldNode, newNodeOld); // ✅ boolean
      if (!equal) {
        const diffs = diff_old_nodes(oldNode, newNodeOld, 10); // ✅ array of paths
        console.warn("[shadow-json][parse] parity mismatch:", diffs);
      }
    } catch (e: any) {
      console.warn("[shadow-json][parse] NEW crashed:", e.message);
    }
  }

  return oldNode;
}