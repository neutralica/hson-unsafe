// src/api/serializers/serialize-html.render.hson.ts 


import { serialize_html_NEW } from "../../new/api/serializers/serialize-html.new.render.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { clone_node } from "../../utils/clone-node.utils.hson";

/* stable entry: returns OLD; parity by reparsing both strings through OLD parser */

export function serialize_html(root: HsonNode_NEW): string {
  const n = clone_node(root);
  assert_invariants_NEW(n, 'serialize-html');
  return serialize_html_NEW(n);
}