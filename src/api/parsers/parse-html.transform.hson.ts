/* src/api/parsers/parse-html.transform.hson.ts */

import { parse_html_NEW } from "../../new/api/parsers/parse-html.new.transform.hson.js";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson.js";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson.js";

/* stable entry: returns OLD; NEW is only used for parity checks */

export function parse_html(html: string): HsonNode_NEW {
  const node = parse_html_NEW(html);
  assert_invariants_NEW(node, 'parse-html');
  return node;
}