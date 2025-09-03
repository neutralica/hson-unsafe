import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { to_OLD } from "../kompat/kompat-layer.refactor.hson";

export function ensure_OLD(n: HsonNode | HsonNode_NEW): HsonNode {
  if (is_Node_NEW(n)) {
    console.log('new node--asserting invariants and converting to old')
    assert_invariants_NEW(n, 'ensure-old');
    return to_OLD(n);
  }
  return n;
}