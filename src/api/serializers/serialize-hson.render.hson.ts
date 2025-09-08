// --- serialize-hson.hson.render.ts ---

import { serialize_hson_NEW } from "../../new/api/serializers/serialize-hson.new.render.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { clone_node } from "../../utils/clone-node.utils.hson";
import { _snip } from "../../utils/snip.utils.hson";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils.hson";


export function serialize_hson(root: HsonNode_NEW): string {
  const n = clone_node(root);
  assert_invariants_NEW(n, 'serialize-hson');
  return serialize_hson_NEW(n);
}