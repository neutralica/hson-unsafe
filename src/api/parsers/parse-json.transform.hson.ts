// parse-json.transform.hson.ts

import { parse_json_NEW } from "../../new/api/parsers/parse-json.new.transform.hson"
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";


export function parse_json(json: string): HsonNode_NEW {
  console.log('parse json wrapper')
  const node = parse_json_NEW(json);
  assert_invariants_NEW(node, 'parse-json');
  return node;
}