// src/api/serializers/serialize-html.render.hson.ts 

import { equal_old_nodes, diff_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { to_NEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { serialize_html_NEW } from "../../new/api/serializers/serialize-html.new.render.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";
import { parse_html_OLD } from "../../old/api/parsers/parse-html.old.transform.hson";
import { serialize_html_OLD } from "../../old/api/serializers/serialize-html.old.render.hson";
import { HsonNode } from "../../types-consts/node.types.hson";

/* stable entry: returns OLD; parity by reparsing both strings through OLD parser */

export function serialize_html(root: HsonNode | HsonNode_NEW): string {
  const n = is_Node_NEW(root as any) ? (root as HsonNode_NEW) : to_NEW(root as HsonNode);
  assert_invariants_NEW(n, 'serialize-html');
  return serialize_html_NEW(n);
}