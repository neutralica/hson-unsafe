import { Primitive } from "../core/types-consts/core.types";
import { STR_TAG, VAL_TAG, II_TAG, ARR_TAG, ROOT_TAG, OBJ_TAG, ELEM_TAG, VSN_TAGS } from "../types-consts/constants";
import { _META_DATA_PREFIX, _DATA_INDEX } from "../types-consts/constants";
import { HsonNode, HsonMeta, HsonAttrs, NodeContent } from "../types-consts/node.new.types";
import { make_string } from "./make-string.utils";
import { _throw_transform_err } from "./throw-transform-err.utils";
import { is_Node } from "./node-guards.new.utils";


/* 
   TODO - add 'alreadyAsserted' flag or similar to prevent multiple tree walks 
   TODO - add 'dev mode' flag to trigger assert_invariants or not
*/


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

export function assert_invariants(root: HsonNode, fn: string = '[source fn not given]', cfg: Cfg = { throwOnFirst: true }): void {
  const errs: string[] = [];
  assertNewShapeQuick(root, fn);
  walk(root, "", root._tag, cfg, errs); 

  if (errs.length) {
    const msg = errs.slice(0, 12).join("\n  - ");
    _throw_transform_err(`invariant violation(s):\n  - ${msg}`, fn, make_string(root).slice(0, 1500));
  }
}

// ---------- core ----------

function walk(n: HsonNode, path: string, parentTag: string | null, cfg: Cfg, errs: string[]): void {
  const here = path + seg(n._tag);

  // meta keys: only data-_*
  if (n._meta) {
    for (const k of Object.keys(n._meta as HsonMeta)) {
      if (!k.startsWith(_META_DATA_PREFIX)) {
        push(errs, cfg, `${here}@meta:${k}: illegal meta key (only "${_META_DATA_PREFIX}*" allowed)`); if (cfg.throwOnFirst) return;
      }
    }
  }

  // VSNs never carry _attrs
  if (isVSN(n._tag) && n._attrs && Object.keys(n._attrs as HsonAttrs).length) {
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
    if (parentTag !== ARR_TAG) { push(errs, cfg, `${here}: _ii must appear directly under _arr`); if (cfg.throwOnFirst) return; }
    if (n._attrs && Object.keys(n._attrs).length) { push(errs, cfg, `${here}: _ii must not have _attrs`); if (cfg.throwOnFirst) return; }
    const idx = n._meta?.[`${_META_DATA_PREFIX}index`] ?? n._meta?.[_DATA_INDEX];
    if (typeof idx !== "string") { push(errs, cfg, `${here}: _ii must carry "${_META_DATA_PREFIX}index" as a string in _meta`); if (cfg.throwOnFirst) return; }

    // CHANGED: use raw, then narrow
    const cc = nodesOnly(n._content);
    if (cc.length !== 1) { push(errs, cfg, `${here}: _ii must contain exactly one child node`); if (cfg.throwOnFirst) return; }
    const only = cc[0];
    if (!is_Node(only)) { push(errs, cfg, `${here}: _ii child must be a node (found primitive/null)`); if (cfg.throwOnFirst) return; }
  }

  // _arr: only _ii children; no bare primitives
  if (n._tag === ARR_TAG) {
    // CHANGED: use raw, narrow per element
    const kids = nodesOnly(n._content);
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      const childPath = `${path}/_arr/[${i}]`;

      if (!is_Node(k)) { push(errs, cfg, `${childPath}: primitive/null outside _str/_val`); if (cfg.throwOnFirst) return; continue; }
      if (k._tag !== II_TAG) { push(errs, cfg, `${childPath}: only _ii allowed directly under _arr`); if (cfg.throwOnFirst) return; }

      // k is HsonNode here
      walk(k, childPath, ARR_TAG, cfg, errs);
      if (cfg.throwOnFirst && errs.length) return;
    }
    return;
  }

  // _root: 0 or 1 child; if present it must be cluster
  if (n._tag === ROOT_TAG) {
    // CHANGED: raw, then narrow
    const kids = nodesOnly(n._content);
    if (kids.length > 1) { push(errs, cfg, `${here}: _root must contain at most one child`); if (cfg.throwOnFirst) return; }
    if (kids.length === 1) {
      const only = kids[0] as HsonNode | Primitive;
      if (!is_Node(only)) {
        push(errs, cfg, `${here}: _root child must be a node, found primitive`);
        if (cfg.throwOnFirst) return;
      } else if (!(only._tag === OBJ_TAG || only._tag === ELEM_TAG || only._tag === ARR_TAG)) {
        push(errs, cfg, `${here}: _root child must be one of _obj/_elem/_arr`);
        if (cfg.throwOnFirst) return;
      }
    }
  }

  // _obj: direct child tags must be unique (object semantics)
  if (n._tag === OBJ_TAG) {
    // CHANGED: raw, narrow before reading _tag
    const raw = nodesOnly(n._content);
    const tags: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      const k = raw[i];
      if (!is_Node(k)) { push(errs, cfg, `${here}/[${i}]: primitive/null outside _str/_val`); if (cfg.throwOnFirst) return; continue; }
      tags.push(k._tag);
    }
    const uniq = new Set(tags);
    if (uniq.size !== tags.length) {
      push(errs, cfg, `${here}: duplicate property tags inside _obj`); if (cfg.throwOnFirst) return;
    }
  }


  // recurse (nodes only); primitives are illegal outside _str/_val
  const kids = n._content ?? [];
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (is_Node(k)) walk(k as HsonNode, here, n._tag, cfg, errs);
    else push(errs, cfg, `${here}/[${i}]: primitive outside _str/_val`);
    if (cfg.throwOnFirst && errs.length) return;
  }
}

// ---------- helpers ----------
function isVSN(t: string) {
  return t === STR_TAG || t === VAL_TAG || t === ARR_TAG || t === OBJ_TAG || t === ELEM_TAG || t === ROOT_TAG || t === II_TAG;
}
function isClusterTag(t: string) { return t === ARR_TAG || t === OBJ_TAG || t === ELEM_TAG; }
function nodesOnly(c?: NodeContent): (HsonNode | Primitive)[] {
  return (c ?? []) as (HsonNode | Primitive)[];
}
function seg(t: string) { return t.startsWith("_") ? `/${t}` : `/tag:${t}`; }
function push(errs: string[], cfg: Cfg, s: string) { errs.push(s); }

function isVSNTag(t: string) {
  return VSN_TAGS.includes(t as any);
}

export function assertNewShapeQuick(n: any, where: string): void {
  const stack: any[] = [n];

  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    const tag = node._tag as string | undefined;
    const meta = node._meta as HsonMeta | undefined;
    const attrs = node._attrs as HsonAttrs | undefined;

    // 1) OLD giveaways in _meta
    if (meta && ("attrs" in meta || "flags" in meta)) {
      throw new Error(`[NEW-only] old-shaped meta in ${where} at <${tag ?? "?"}>
  Found _meta.attrs or _meta.flags`);
    }

    // 2) Only data-_ keys allowed in _meta
    if (meta) {
      for (const k of Object.keys(meta)) {
        if (!k.startsWith("data-_")) {
          throw new Error(`[NEW-only] illegal meta key "${k}" in ${where} at <${tag}> (only "data-_*" allowed)`);
        }
      }
    }

    // 3) VSNs must not carry _attrs
    if (tag && isVSNTag(tag) && attrs && Object.keys(attrs).length) {
      throw new Error(`[NEW-only] VSN <${tag}> carries _attrs in ${where}`);
    }

    // 4) Recurse nodes-only
    const content = node._content as unknown[] | undefined;
    if (Array.isArray(content)) {
      // Don’t descend into leaves; main walk already validates payload shape/arity
      if (tag === STR_TAG || tag === VAL_TAG) {
        // optional: enforce arity here if you want, but don’t throw on the primitive itself
        // if (content.length !== 1) throw new Error('...'); // up to you
      } else {
        for (const c of content) {
          // Only push nodes; ignore primitives here.
          if (c && typeof c === 'object' && '_tag' in c) {
            stack.push(c as HsonNode);
          }
          // else: let main walk flag “primitive outside _str/_val”
        }
      }
    }
  }
}