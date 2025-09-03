// --- serialize-hson.hson.render.ts ---

import { diff_New } from "../../_refactor/_refactor-utils/diff-new-nodes.new.utils.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { equalNEW, to_NEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { normalizeNEWStrict } from "../../_refactor/kompat/normalizers.kompat.hson";
import { parse_hson_NEW } from "../../new/api/parsers/parse_hson.new.transform.hson";
import { serialize_hson_NEW } from "../../new/api/serializers/serialize-hson.new.render.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";
import { parse_hson_OLD } from "../../old/api/parsers/parse-hson.old.transform.hson";
import { serialize_hson_OLD } from "../../old/api/serializers/serialize-hson.old.render.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { make_string } from "../../utils/make-string.utils.hson";
import { _snip } from "../../utils/snip.utils.hson";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils.hson";


/* debug log */
let _VERBOSE = true;
const STYLE = 'color:lightgreen;font-weight:600;padding:1px 3px;border-radius:4px';
// tweak _log to style every arg (incl. your prefix), no helpers:
const _log = _VERBOSE
  ? (...args: unknown[]) =>
    console.log(
      ['%c%s', ...args.map(() => '%c%o')].join(' '),
      STYLE, '[srlz hson ***WRAPPER***] →',
      ...args.flatMap(a => [STYLE, a]),
    )
  : () => { };


/* helper: keep logs lightweight (no nodes) */
function summarizeChanges(changes: ReturnType<typeof diff_New>, max = 8) {
  return changes.slice(0, max).map(c => ({ kind: c.kind, path: c.path }));
}

export function serialize_hson(root: HsonNode | HsonNode_NEW): string {
  const n = is_Node_NEW(root) ? (root) : to_NEW(root);
  assert_invariants_NEW(n, 'serialize-hson');
  return serialize_hson_NEW(n);
}