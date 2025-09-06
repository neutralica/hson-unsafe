// --- serialize-hson.hson.render.ts ---

import { diff_New } from "../../_refactor/_refactor-utils/diff-new-nodes.new.utils.hson";
import { equalNEW, to_NEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { serialize_hson_NEW } from "../../new/api/serializers/serialize-hson.new.render.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { _snip } from "../../utils/snip.utils.hson";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils.hson";


export function serialize_hson(root: HsonNode | HsonNode_NEW): string {
  const n = is_Node_NEW(root) ? (root) : to_NEW(root);
  assert_invariants_NEW(n, 'serialize-hson');
  return serialize_hson_NEW(n);
}