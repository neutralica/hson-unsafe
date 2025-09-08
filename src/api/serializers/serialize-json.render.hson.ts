/* serialize-json.render.hson.ts */

/* shadow inputs */
import { serialize_json_NEW } from "../../new/api/serializers/serialize-json.new.render.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { clone_node } from "../../utils/clone-node.utils.hson";

/* exported wrapper */

export function serialize_json(root:  HsonNode_NEW): string {
  const n = clone_node(root as HsonNode_NEW);
  assert_invariants_NEW(n, 'serialize-json');
  return serialize_json_NEW(n);
}