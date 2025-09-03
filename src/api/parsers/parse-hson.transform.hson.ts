import { bucket_diffs } from "../../_refactor/_refactor-utils/bucket-diffs.utils.hson";
import { diff_old_nodes, equal_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson";
import { diff_New } from "../../_refactor/_refactor-utils/diff-new-nodes.new.utils.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { equalNEW, to_NEW, to_OLD } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { parse_hson_NEW } from "../../new/api/parsers/parse_hson.new.transform.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { parse_hson_OLD } from "../../old/api/parsers/parse-hson.old.transform.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { clone_node } from "../../utils/clone-node.utils.hson";
import { make_string } from "../../utils/make-string.utils.hson";


export function parse_hson(str: string): HsonNode_NEW {
  console.log('parse hson wrapper')
  const node = parse_hson_NEW(str);
  assert_invariants_NEW(node, 'parse-hson');          // fast structural sanity
  return node;                          // NEW is now the public shape
}