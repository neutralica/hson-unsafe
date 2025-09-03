import { Primitive } from "../../core/types-consts/core.types.hson";
import { STR_TAG, VAL_TAG, II_TAG, ARR_TAG, ROOT_TAG, OBJ_TAG, ELEM_TAG } from "../../types-consts/constants.hson";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils.hson";
import { _DATA_INDEX, _META_DATA_PREFIX } from "../types-consts/constants.new.hson";
import { HsonNode_NEW, HsonMeta_NEW, HsonAttrs_NEW, NodeContent_NEW } from "../types-consts/node.new.types.hson";
import { is_Node_NEW } from "./node-guards.new.utils.hson";

type Cfg = { throwOnFirst?: boolean };
const _VERBOSE = true;
const STYLE = 'color:violet;font-weight:400;padding:1px 3px;border-radius:4px';
// tweak _log to style every arg (incl. your prefix), no helpers:
const _log = _VERBOSE
  ? (...args: unknown[]) =>
    console.log(
      ['%c%s', ...args.map(() => '%c%o')].join(' '),
      STYLE, '[ASSERT_INVARIANTS] →',
      ...args.flatMap(a => [STYLE, a]),
    )
  : () => { };

export function assert_invariants_NEW(root: HsonNode_NEW, fn: string = '[source fn not given]', cfg: Cfg = { throwOnFirst: true }): void {
  // const errs: string[] = [];
  // walk(root, "", null, cfg, errs);
  // if (errs.length) {
  //   const msg = errs.slice(0, 12).join("\n  - ");
  //   _throw_transform_err(`NEW invariant violation(s):\n  - ${msg}`, fn, JSON.stringify(root).slice(0, 1500));
  // } else {
  //   _log('node shape passes!!');
  // }
}

// ---------- core ----------

function walk(n: HsonNode_NEW, path: string, parentTag: string | null, cfg: Cfg, errs: string[]): void {
  const here = path + seg(n._tag);

  // meta keys: only data-_*
  if (n._meta) {
    for (const k of Object.keys(n._meta as HsonMeta_NEW)) {
      if (!k.startsWith(_META_DATA_PREFIX)) {
        push(errs, cfg, `${here}@meta:${k}: illegal meta key (only "${_META_DATA_PREFIX}*" allowed)`); if (cfg.throwOnFirst) return;
      }
    }
  }

  // VSNs never carry _attrs
  if (isVSN(n._tag) && n._attrs && Object.keys(n._attrs as HsonAttrs_NEW).length) {
    push(errs, cfg, `${here}: VSN "${n._tag}" must not have _attrs`); if (cfg.throwOnFirst) return;
  }

  // value wrappers
  if (n._tag === STR_TAG || n._tag === VAL_TAG) {
    const c = n._content ?? [];
    if (c.length !== 1) {
      push(errs, cfg, `${here}: ${n._tag} must have exactly one item in _content`); if (cfg.throwOnFirst) return;
    } else {
      const v = c[0] as Primitive;
      if (n._tag === STR_TAG && typeof v !== "string") {
        push(errs, cfg, `${here}: _str payload must be string`); if (cfg.throwOnFirst) return;
      }
      if (n._tag === VAL_TAG && typeof v === "string") {
        push(errs, cfg, `${here}: _val payload must be non-string primitive`); if (cfg.throwOnFirst) return;
      }
    }
    return; // leaf
  }

  // _ii allowed only directly under _arr; must have exactly one child node; meta only data-_index; no attrs
  if (n._tag === II_TAG) {
    if (parentTag !== ARR_TAG) {
      push(errs, cfg, `${here}: _ii must appear directly under _arr`); if (cfg.throwOnFirst) return;
    }
    if (n._attrs && Object.keys(n._attrs).length) {
      push(errs, cfg, `${here}: _ii must not have _attrs`); if (cfg.throwOnFirst) return;
    }
    const idx = n._meta?.[`${_META_DATA_PREFIX}index`] ?? n._meta?.[_DATA_INDEX]; // tolerate both spellings if seen
    if (typeof idx !== "string") {
      push(errs, cfg, `${here}: _ii must carry "${_META_DATA_PREFIX}index" as a string in _meta`); if (cfg.throwOnFirst) return;
    }
    const cc = nodesOnly(n._content);
    if (cc.length !== 1) {
      push(errs, cfg, `${here}: _ii must contain exactly one child node`); if (cfg.throwOnFirst) return;
    }
  }

  // _arr: only _ii children; no bare primitives
  if (n._tag === ARR_TAG) {
    const kids = nodesOnly(n._content);
    kids.forEach((kid, i) => {
      const childPath = `${path}/_arr/[${i}]`;
      assert_invariants_NEW(kid, 'assert invariants recurse');
    });
    return;
  }

  // _root: 0 or 1 child; if present it must be cluster
  if (n._tag === ROOT_TAG) {
    const kids = nodesOnly(n._content);
    if (kids.length > 1) {
      push(errs, cfg, `${here}: _root must contain at most one child`); if (cfg.throwOnFirst) return;
    }
    if (kids.length === 1 && !isClusterTag(kids[0]._tag)) {
      push(errs, cfg, `${here}: _root child must be one of _obj/_elem/_arr`); if (cfg.throwOnFirst) return;
    }
  }

  // _obj: direct child tags must be unique (object semantics)
  if (n._tag === OBJ_TAG) {
    const tags = nodesOnly(n._content).map(c => c._tag);
    const uniq = new Set(tags);
    if (uniq.size !== tags.length) {
      push(errs, cfg, `${here}: duplicate property tags inside _obj`); if (cfg.throwOnFirst) return;
    }
  }

  // recurse (nodes only); primitives are illegal outside _str/_val
  const kids = n._content ?? [];
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (is_Node_NEW(k)) walk(k, here, n._tag, cfg, errs);
    else push(errs, cfg, `${here}/[${i}]: primitive outside _str/_val`);
    if (cfg.throwOnFirst && errs.length) return;
  }
}

// ---------- helpers ----------
function isVSN(t: string) {
  return t === STR_TAG || t === VAL_TAG || t === ARR_TAG || t === OBJ_TAG || t === ELEM_TAG || t === ROOT_TAG || t === II_TAG;
}
function isClusterTag(t: string) { return t === ARR_TAG || t === OBJ_TAG || t === ELEM_TAG; }
function nodesOnly(c?: NodeContent_NEW) { return (c ?? []).filter(is_Node_NEW) as HsonNode_NEW[]; }
function seg(t: string) { return t.startsWith("_") ? `/${t}` : `/tag:${t}`; }
function push(errs: string[], cfg: Cfg, s: string) { errs.push(s); }