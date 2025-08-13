// kompat-layer.refactor.hson.ts

import { Primitive } from '../../core/types-consts/core.types.hson';
import {HsonAttrs_NEW, HsonMeta_NEW, HsonNode_NEW, NodeContent_NEW} from '../../new/types-consts/new.types.hson'
import { HsonFlags, HsonNode, HsonMeta, NodeContent } from '../../types-consts/node.types.hson';

/* normalize legacy flags into attrs */
function flagsToAttrs(flags: HsonFlags | undefined, into: Record<string, Primitive>) {
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
  const out: HsonFlags = [];
  for (const [k, v] of Object.entries(attrs)) {
    /* CHANGED: only accept exact duplication key="key" as a legacy flag */
    if (v === k) out.push(k);
  }
  return out;
}

export function toNEW(nodeOld: HsonNode): HsonNode_NEW {
  const { _tag, _content = [], _meta } = nodeOld;
  const attrsOld = (_meta?.attrs ?? {}) as Record<string, Primitive>;
  const flagsOld = _meta?.flags;

  const _attrs: HsonAttrs_NEW = { ...attrsOld };
  /* fold legacy flags into attrs */
  flagsToAttrs(flagsOld, _attrs);

  /*  NEW _meta: keep the rest of meta, but drop attrs/flags */
  const { attrs: _dropA, flags: _dropF, ...restMeta } = (_meta ?? {}) as any;
  const _metaNew: HsonMeta_NEW = { ...(restMeta as Record<string, Primitive>) };

  const _contentNew = _content.map(c =>
    (c && typeof c === "object" && "_tag" in (c as any)) ? toNEW(c as HsonNode) : c
  ) as NodeContent_NEW;

  return { _tag, _attrs, _content: _contentNew, _meta: _metaNew };
}

export function toOLD(nodeNew: HsonNode_NEW): HsonNode {
  const { _tag, _content = [], _attrs = {}, _meta = {} } = nodeNew;

  const attrsOld = { ..._attrs } as Record<string, Primitive>;
  const flagsOld = attrsToFlags(attrsOld); // only key="key" attrs become flags

  const metaOld: HsonMeta = {
    ...( _meta as Record<string, Primitive> ),
    attrs: attrsOld,  
    flags: flagsOld,
  };

  const _contentOld = _content.map(c =>
    (c && typeof c === "object" && "_tag" in (c as any)) ? toOLD(c as HsonNode_NEW) : c
  ) as NodeContent;

  return { _tag, _content: _contentOld, _meta: metaOld, _attrs: undefined as any }; // keep old shape
}

export function equalNEW(a: HsonNode_NEW, b: HsonNode_NEW): boolean {
  return JSON.stringify(normalizeNEW(a)) === JSON.stringify(normalizeNEW(b));
}

/*  canonicalize a NEW node for stable stringify */
function normalizeNEW(v: any): any {
  if (Array.isArray(v)) return v.map(normalizeNEW);

  /* node case */
  if (v && typeof v === 'object' && '_tag' in v) {
    const _tag = v._tag as string;
    const _attrs = sortObject(v._attrs ?? {});        /* treat undefined as {} */
    const _meta  = sortObject(v._meta  ?? {});        /* treat undefined as {} */
    const raw = Array.isArray(v._content) ? v._content : [];
    const _content = raw.map(normalizeNEW);           /* recurse */

    /* only keep canonical fields in a stable order */
    return { _tag, _attrs, _meta, _content };
  }

  /* primitive */
  return v;
}

/* permanent: return a new object with keys sorted lexicographically */
function sortObject(obj: Record<string, Primitive>): Record<string, Primitive> {
  const out: Record<string, Primitive> = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}