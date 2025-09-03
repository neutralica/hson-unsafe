/* serialize-json.render.hson.ts */

/* keep: OLD is the truth we return */
import { serialize_json_OLD } from "../../old/api/serializers/serialize-json.old.render.hson";

/* shadow inputs */
import { serialize_json_NEW } from "../../new/api/serializers/serialize-json.new.render.hson";
import { to_NEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import type { HsonNode } from "../../types-consts/node.types.hson";
import { canonicalize } from "../../utils/canonicalize.utils.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";

/* exported wrapper */

export function serialize_json(root: HsonNode | HsonNode_NEW): string {
  const n = is_Node_NEW(root as any) ? (root as HsonNode_NEW) : to_NEW(root as HsonNode);
  assert_invariants_NEW(n, 'serialize-json');
  return serialize_json_NEW(n);
}