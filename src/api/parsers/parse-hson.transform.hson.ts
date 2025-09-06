
import { parse_hson_NEW } from "../../new/api/parsers/parse_hson.new.transform.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";

export function parse_hson(str: string): HsonNode_NEW {
  const node = parse_hson_NEW(str);
  assert_invariants_NEW(node, 'parse-hson');          // fast structural sanity
  return node;                          // NEW is now the public shape
}