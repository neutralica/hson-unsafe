// kompat-layer.refactor.hson.ts

import { Primitive } from '../../core/types-consts/core.types.hson';
import { _DATA_INDEX, _DATA_QUID, _META_DATA_PREFIX } from '../../new/types-consts/constants.new.hson';
import { HsonAttrs_NEW, HsonMeta_NEW, HsonNode_NEW, NodeContent_NEW } from '../../new/types-consts/node.new.types.hson'
import { is_Node_NEW } from '../../new/utils/node-guards.new.utils.hson';
import { parse_primitive } from '../../new/utils/parse-primitive.new.utils.hson';
import { ARR_TAG, ELEM_TAG, OBJ_TAG } from '../../types-consts/constants.hson';
import { HsonFlags, HsonNode, HsonMeta, NodeContent } from '../../types-consts/node.types.hson';
import { is_Node } from '../../utils/node-guards.utils.hson';
import { parse_style } from '../../utils/parse-css.utils.hson';
import { serialize_style } from '../../utils/serialize-css.utils.hson';
import { normalize_style } from '../_refactor-utils/compare-normalize.utils.hson';
import { diff_New } from '../_refactor-utils/diff-new-nodes.new.utils.hson';
import { normalizeNode } from './normalizers.kompat.hson';



/* debug log */
let _VERBOSE = false;
const STYLE = 'color:hotpink;font-weight:400;padding:1px 3px;border-radius:4px';
// tweak _log to style every arg (incl. your prefix), no helpers:
const _log = _VERBOSE
  ? (...args: unknown[]) =>
    console.log(
      ['%c%s', ...args.map(() => '%c%o')].join(' '),
      STYLE, '[KOMPAT] →',
      ...args.flatMap(a => [STYLE, a]),
    )
  : () => { };


/* normalize legacy flags into attrs */
function flagsToAttrs(flags: HsonFlags | undefined, into: Record<string, Primitive>) {
  // _log('normalizing legacy flags shape and moving into _attrs (for _NEW path)')
  if (!flags) return;
  for (const f of flags) {
    if (typeof f === "string") {
      /* boolean flag -> xml-style key="key" */
      into[f] = f; /* CHANGED: canonical form */
    } else if (f && typeof f === "object") {
      /* kv pair flag -> merge directly */
      for (const [k, v] of Object.entries(f)) into[k] = v as Primitive;
    }
  }
}



/* derive legacy flags only when value === key (do not treat true/"true" as flags) */
function attrsToFlags(attrs: Record<string, Primitive>): HsonFlags {
  // _log('derive legacy flag properties from attributes where value === key')
  const out: HsonFlags = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v === k) out.push(k);
  }
  return out;
}

export function to_NEW(nodeOld: HsonNode): HsonNode_NEW {
  // _log('toNEW called');
  const { _tag, _content = [], _meta } = nodeOld;

  const attrsOld = { ...(_meta?.attrs ?? {}) } as Record<string, Primitive>;
  const flagsOld = _meta?.flags ?? [];

  // 1) Split OLD attrs: move all 'data-_' wire-meta into NEW._meta; keep the rest in NEW._attrs
  const _attrs: HsonAttrs_NEW = {};
  const _metaNew: HsonMeta_NEW = {};
  for (const [k, v] of Object.entries(attrsOld)) {
    if (k === _DATA_INDEX) {                 // OLD storage under _meta.attrs
      _metaNew[_DATA_INDEX] = String(v);
      continue;
    }
    if (k === _DATA_QUID) {
      _metaNew[_DATA_QUID] = String(v);
      continue;
    }
    if (typeof k === "string" && k.startsWith(_META_DATA_PREFIX)) {
      if (v != null) _metaNew[k] = String(v);
    } else {
      _attrs[k] = v as any;
    }
  }
  

  // 1a) Optional: normalize style string → object for NEW
  if (typeof _attrs.style === "string") {
    _attrs.style = parse_style(_attrs.style as string);
  }

  // 1b) Fold legacy flags into attrs (key:"key")
  flagsToAttrs(flagsOld, _attrs);

  // 2) Carry remaining top-level meta (excluding attrs/flags) straight across
  const { attrs: _dropA, flags: _dropF, ...restMeta } = (_meta ?? {}) as any;
  for (const [k, v] of Object.entries(restMeta)) {
    _metaNew[k] = v as any;
  }

  // 3) Recurse children
  // _log('recursing children');
  const _contentNew = _content.map(c =>
    is_Node(c) ? to_NEW(c) : (c as Primitive)
  ) as NodeContent_NEW;

  return { _tag, _attrs, _content: _contentNew, _meta: _metaNew };
}


/** Detects <_obj|_elem> containing exactly one child that is _array */
function unwrapSoleArrayChild_NEW(node: HsonNode_NEW | undefined): HsonNode_NEW | undefined {
  _log('unwrap sole array child');
  if (!node || !is_Node_NEW(node)) return undefined;
  if (node._tag !== OBJ_TAG) return undefined;
  const kids = Array.isArray(node._content) ? node._content : [];
  if (kids.length !== 1 || !is_Node_NEW(kids[0])) return undefined;
  return kids[0]._tag === ARR_TAG ? kids[0] : undefined;
}

export function to_OLD(nodeNew: HsonNode_NEW): HsonNode {
  // _log('to_OLD called')
  const { _tag, _content = [], _attrs, _meta } = nodeNew;

  // 1) clone user attrs and promote boolean flags (key === "key")
  const attrsOld: Record<string, Primitive> = { ...(_attrs ?? {}) };
  const flagsOld: string[] = [];
  for (const k of Object.keys(attrsOld)) {
    if ((attrsOld as any)[k] === k) {
      flagsOld.push(k);
      delete attrsOld[k];
    }
  }

  // 1a) optional: stringify style object
  const st = attrsOld["style"];
  if (st && typeof st === "object") {
    attrsOld["style"] = serialize_style(st as Record<string, string>) as any;
  }

  // 2) NEW _meta → OLD meta:
  //    - move all 'data-_' (wire meta) into meta.attrs
  //    - leave all other meta keys at top-level (unchanged)
  const sys: Record<string, Primitive> = { ...(_meta ?? {}) };
  const metaOldAttrs: Record<string, Primitive> = { ...attrsOld };

  for (const [k, v] of Object.entries(sys)) {
    if (typeof k === "string" && k.startsWith(_META_DATA_PREFIX)) { // 'data-_'
      metaOldAttrs[k] = String(v);
      delete sys[k]; // OLD doesn’t expect these at top-level
    }
  }

  // 3) recurse children (ALWAYS-WRAP: do not flatten)
  let contentOld: NodeContent = [];
  const sole = Array.isArray(_content) && _content.length === 1 && is_Node_NEW(_content[0])
    ? unwrapSoleArrayChild_NEW(_content[0] as HsonNode_NEW)
    : undefined;

  if (sole) {
    // Present the array directly under the tag in OLD
    contentOld = [to_OLD(sole)];
  } else {
    contentOld = _content.map(c =>
      (is_Node_NEW(c) ? to_OLD(c as HsonNode_NEW) : (c as Primitive)));
  }

  // (Optional) legacy quirk: flatten sole array under _obj/_elem (disabled by default)
  // if (LEGACY_FLATTEN_SOLE_ARRAY) {
  //   const first = Array.isArray(contentOld) && contentOld[0] as any;
  //   // ...do your guarded flatten here if you really need it
  // }

  // 4) exact OLD shape
  const metaOld: HsonMeta = {
    ...sys,              // other system keys at top-level (OLD)
    attrs: metaOldAttrs, // user attrs + all 'data-_' wire meta
    flags: flagsOld,
  };

  return { _tag, _content: contentOld, _meta: metaOld } as HsonNode;
}

export function equalNEW(a: HsonNode_NEW, b: HsonNode_NEW): boolean {
  return diff_New(a, b).length === 0;  // ← replace stringify-equal
}


/* permanent: return a new object with keys sorted lexicographically */
export function sortObjectStrings(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}