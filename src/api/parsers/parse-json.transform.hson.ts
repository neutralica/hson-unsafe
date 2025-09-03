// parse-json.transform.hson.ts

import { to_NEW, to_OLD } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { parse_json_NEW } from "../../new/api/parsers/parse-json.new.transform.hson"
import { HsonNode } from "../../types-consts/node.types.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { diff_old_nodes, equal_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson";
import { parse_json_OLD } from "../../old/api/parsers/parse-json.old.transform.hson";
import { clone_node } from "../../utils/clone-node.utils.hson";
import { make_string } from "../../utils/make-string.utils.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";


export function parse_json(json: string): HsonNode_NEW {
  console.log('parse json wrapper')
  const node = parse_json_NEW(json);
  assert_invariants_NEW(node, 'parse-json');
  return node;
}