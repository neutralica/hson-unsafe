/* src/api/parsers/parse-html.transform.hson.ts */

import type { HsonNode } from "../../types-consts/node.types.hson.js";
import { parse_html_OLD } from "../../old/api/parsers/parse-html.old.transform.hson.js";
import { parse_html_NEW } from "../../new/api/parsers/parse-html.new.transform.hson.js";
import { equal_old_nodes, diff_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson.js";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson.js";
import { to_NEW, to_OLD } from "../../_refactor/kompat/kompat-layer.refactor.hson.js";
import { clone_node } from "../../utils/clone-node.utils.hson.js";
import { sanitize_for_xml } from "../../utils/html-filtration.utils.hson.js";
import { bucket_diffs } from "../../_refactor/_refactor-utils/bucket-diffs.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson.js";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson.js";

/* stable entry: returns OLD; NEW is only used for parity checks */

export function parse_html(html: string): HsonNode_NEW {
  console.log('parse html wrapper')
  const node = parse_html_NEW(html);
  assert_invariants_NEW(node, 'parse-html');
  return node;
}