// --- serialize-hson.hson.render.ts ---

import { diffNEW } from "../../_refactor/_refactor-utils/diff-new-nodes.new.utils.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import { equalNEW, to_NEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { normalizeNEWStrict } from "../../_refactor/kompat/normalizers.kompat.hson";
import { parse_hson_NEW } from "../../new/api/parsers/parse_hson.new.transform.hson";
import { serialize_hson_NEW } from "../../new/api/serializers/serialize-hson.new.render.hson";
import { parse_hson_OLD } from "../../old/api/parsers/parse-hson.old.transform.hson";
import { serialize_hson_OLD } from "../../old/api/serializers/serialize-hson.old.render.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { make_string } from "../../utils/make-string.utils.hson";
import { _snip } from "../../utils/preview-long.utils.hson";
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
function summarizeChanges(changes: ReturnType<typeof diffNEW>, max = 8) {
  return changes.slice(0, max).map(c => ({ kind: c.kind, path: c.path }));
}

export function serialize_hson(root: HsonNode /* OLD shape OK here */): string {
  _log('SERIALIZE HSON WRAPPER - beginning');
  if (_VERBOSE) {
    console.groupCollapsed('node:');
    _log(root);
    console.groupEnd();
  }
  const oldWire = serialize_hson_OLD(root);
  _log('old path successful: ', _snip(oldWire, 500))
  if (!SHADOW_ENABLED()) return oldWire;

  try {
    _log('attempting new serialization route');
    /* CHANGED: normalize to canonical NEW before hitting NEW serializer */
    _log('converting HsonNode to _NEW and normalizing...');
    const rootNEW = normalizeNEWStrict(to_NEW(root));                // /* added */
    if (_VERBOSE) {
      console.groupCollapsed('node:');
      _log(rootNEW);
      console.groupEnd();
    }
    _log('serializing hson via _NEW path');
    const newWire: string = serialize_hson_NEW(rootNEW);                    // /* changed: pass normalized NEW */

    /* Compare NEW→NEW by parsing both wires with OLD parser → toNEW → normalizeNEWStrict */
    _log('re-parsing OLD serialization & converting ...')
    const oldBackNEW = normalizeNEWStrict(to_NEW(parse_hson_OLD(oldWire)));
    if (_VERBOSE) {
      console.groupCollapsed('oldBack:');
      _log(oldBackNEW);
      console.groupEnd();
    }
    _log('re-parsing NEW serialization & converting ...')
    const newBackNEW = normalizeNEWStrict(parse_hson_NEW(newWire));
    if (_VERBOSE) {
      console.groupCollapsed('newBack:');
      _log(newBackNEW);
      console.groupEnd();
    }
    const seen = new Set<string>(); // process-wide or module-local

    // ...
    const changes = diffNEW(newBackNEW, oldBackNEW);
    if (changes.length) {
      const sig = JSON.stringify({ a: newBackNEW._tag, b: oldBackNEW._tag, wires: [oldWire.length, newWire.length], first: changes[0]?.path });
      if (!seen.has(sig)) {
        seen.add(sig);
        console.warn("[shadow-HSON][serialize] NEW≠OLD",
          make_string(changes.slice(0, 12).map(c => ({ kind: c.kind, path: c.path }))));
      }
    } else {
      _log('hson nodes old and _NEW are equal!!')
    }
  } catch (err) {
    /* CHANGED: keep error path “cold” — do not call make_string/canonicalize here */
    const msg = err instanceof Error ? err.message : String(err);
    // minimal context; no node serialization
    _throw_transform_err(`[shadow-HSON][serialize] NEW crashed: ${msg}`, 'serialize-hson WRAPPER');
  }

  return oldWire;
}