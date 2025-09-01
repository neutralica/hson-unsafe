import { Primitive } from "../../core/types-consts/core.types.hson";
import { _META_DATA_PREFIX } from "../../new/types-consts/constants.new.hson";
import { HsonAttrs_NEW, HsonMeta_NEW, HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";
import { ARR_TAG, ELEM_TAG, II_TAG, OBJ_TAG, ROOT_TAG, STR_TAG, VAL_TAG } from "../../types-consts/constants.hson";
import { serialize_style } from "../../utils/serialize-css.utils.hson";
import { normalize_style } from "./compare-normalize.utils.hson";
// --- diff-new.nodes.hson.ts ---
// NEW-shape differ for HsonNode_NEW trees.
// Assumes inputs were already normalized (normalizeNEWStrict):
//  - no bare primitives (only _str/_val carry values)
//  - VSNs have no _attrs
//  - _meta keys are all `data-_...` with string values
//  - _arr is a first-class cluster (not wrapped in _obj)
//  - _root has exactly one cluster child
//
// Integrate in shadow mode like:
//   const A = normalizeNEWStrict(toNEW(parseOLD(oldWire)));
//   const B = normalizeNEWStrict(toNEW(parseOLD(newWire)));
//   const changes = diffNEW(A, B);

/* ────────────────────────────── Change model ─────────────────────────────── */

export type Change =
  | { kind: "replaceTag"; path: string; from: string; to: string }
  | { kind: "addAttr";    path: string; key: string; value: Primitive }
  | { kind: "delAttr";    path: string; key: string; prev: Primitive }
  | { kind: "chgAttr";    path: string; key: string; from: Primitive; to: Primitive }
  | { kind: "addMeta";    path: string; key: `data-_${string}`; value: string }
  | { kind: "delMeta";    path: string; key: `data-_${string}`; prev: string }
  | { kind: "chgMeta";    path: string; key: `data-_${string}`; from: string; to: string }
  | { kind: "insertNode"; path: string; index?: number; node: HsonNode_NEW }
  | { kind: "removeNode"; path: string; index?: number; node: HsonNode_NEW }
  | { kind: "replaceNode";path: string; index?: number; from: HsonNode_NEW; to: HsonNode_NEW }
  | { kind: "chgValue";   path: string; nodeTag: typeof STR_TAG | typeof VAL_TAG; from: Primitive; to: Primitive };

/* ───────────────────────────── path helpers ──────────────────────────────── */

function p(base: string, seg: string): string {
  return base + (seg.startsWith("/") ? seg : "/" + seg);
}
function pTag(base: string, tag: string): string {
  // standard tag step
  return p(base, `tag:${tag}`);
}
function pVSN(base: string, vsn: string): string {
  // '/_obj', '/_elem', '/_arr', '/_root', '/_str', '/_val'
  return p(base, vsn);
}
function pIdx(base: string, i: number): string {
  return p(base, `[${i}]`);
}
function pProp(base: string, childTag: string): string {
  return p(base, `prop:${childTag}`);
}
function pAttr(base: string, key: string): string {
  return base + `@attr:${key}`;
}
function pMeta(base: string, key: `data-_${string}`): string {
  return base + `@meta:${key}`;
}

/* ───────────────────────────── small utils ──────────────────────────────── */

function isNode(x: unknown): x is HsonNode_NEW {
  return !!x && typeof x === "object" && "_tag" in (x as any);
}

function unwrapII(n: HsonNode_NEW): HsonNode_NEW {
  if (n._tag !== II_TAG) return n;
  const c = n._content?.[0];
  if (!isNode(c)) return n;
  return c;
}

function childrenNodes(n: HsonNode_NEW): HsonNode_NEW[] {
  return (n._content ?? []).filter(isNode) as HsonNode_NEW[];
}

function isClusterTag(tag: string): tag is typeof OBJ_TAG | typeof ELEM_TAG | typeof ARR_TAG | typeof ROOT_TAG {
  return tag === OBJ_TAG || tag === ELEM_TAG || tag === ARR_TAG || tag === ROOT_TAG;
}

function isValueTag(tag: string): tag is typeof STR_TAG | typeof VAL_TAG {
  return tag === STR_TAG || tag === VAL_TAG;
}

/* ───────────────────────────── attrs/meta diff ───────────────────────────── */

function canonStyle(v: unknown): string {
  const obj = normalize_style(v as any) || {}; /* <-- default to {} */
  return serialize_style(obj as Record<string, string>);
}
function diffAttrs(path: string, aAttrs?: HsonAttrs_NEW, bAttrs?: HsonAttrs_NEW): void {
  const A = aAttrs ?? {};
  const B = bAttrs ?? {};

  const aKeys = new Set(Object.keys(A));
  const bKeys = new Set(Object.keys(B));

  // deletions
  for (const k of aKeys) {
    if (!bKeys.has(k)) {
      const av = (A as any)[k];
      const prev: Primitive = k === "style" ? (canonStyle(av) as unknown as Primitive) : (av as Primitive);
      outArr.push({ kind: "delAttr", path: `${path}@attr:${k}`, key: k, prev });
    }
  }

  // additions
  for (const k of bKeys) {
    if (!aKeys.has(k)) {
      const bv = (B as any)[k];
      const value: Primitive = k === "style" ? (canonStyle(bv) as unknown as Primitive) : (bv as Primitive);
      outArr.push({ kind: "addAttr", path: `${path}@attr:${k}`, key: k, value });
    }
  }

  // changes
  for (const k of aKeys) {
    if (!bKeys.has(k)) continue;
    const av = (A as any)[k];
    const bv = (B as any)[k];

    if (k === "style") {
      const from = canonStyle(av);
      const to   = canonStyle(bv);
      if (from !== to) {
        outArr.push({
          kind: "chgAttr",
          path: `${path}@attr:${k}`,
          key: k,
          from: from as unknown as Primitive,
          to:   to   as unknown as Primitive,
        });
      }
      continue;
    }

    // shallow primitive compare (attrs values are Primitive except style)
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      outArr.push({
        kind: "chgAttr",
        path: `${path}@attr:${k}`,
        key: k,
        from: av as Primitive,
        to:   bv as Primitive,
      });
    }
  }
}

function primEq(a: Primitive, b: Primitive): boolean {
  // strings/booleans/numbers/null compare by ===; NaN is not allowed by invariants.
  return a === b;
}

function diffMeta(path: string, a?: HsonMeta_NEW, b?: HsonMeta_NEW, out: Change[] = outArr): void {
  const filterKeys = (m?: HsonMeta_NEW) =>
    m ? Object.keys(m).filter(k => k.startsWith(_META_DATA_PREFIX)).sort() : [];

  const aKeys = filterKeys(a);
  const bKeys = filterKeys(b);

  let i = 0, j = 0;
  while (i < aKeys.length || j < bKeys.length) {
    const ak = aKeys[i] as `data-_${string}` | undefined;
    const bk = bKeys[j] as `data-_${string}` | undefined;

    if (!bk || (ak && ak < bk)) {
      const prev = String((a as any)[ak!]);
      out.push({ kind: "delMeta", path: pMeta(path, ak!), key: ak!, prev });
      i++;
    } else if (!ak || bk < ak) {
      const value = String((b as any)[bk!]);
      out.push({ kind: "addMeta", path: pMeta(path, bk!), key: bk!, value });
      j++;
    } else {
      const av = String((a as any)[ak]);
      const bv = String((b as any)[bk]);
      if (av !== bv) {
        out.push({ kind: "chgMeta", path: pMeta(path, ak), key: ak, from: av, to: bv });
      }
      i++; j++;
    }
  }
}

/* ───────────────────────────── core dispatch ────────────────────────────── */

let outArr: Change[] = []; // re-used buffer for recursion



export function diffNEW(a: HsonNode_NEW, b: HsonNode_NEW): Change[] {
  outArr = [];
  walkNode("", a, b);
  const out = outArr;
  outArr = []; // reset
  return out;
}

function walkNode(path: string, a: HsonNode_NEW, b: HsonNode_NEW): void {
  // tag mismatch → replace node (simplest, avoids cascading noise)
  if (a._tag !== b._tag) {
    // if both are value tags, emit chgValue instead (higher signal)
    if (isValueTag(a._tag) && isValueTag(b._tag)) {
      const av = a._content?.[0] as Primitive;
      const bv = b._content?.[0] as Primitive;
      if (!primEq(av, bv) || a._tag !== b._tag) {
        outArr.push({ kind: "chgValue", path: pVSN(path, `/_${a._tag === STR_TAG ? "str" : "val"}`), nodeTag: b._tag as any, from: av, to: bv });
      }
      return;
    }
    outArr.push({ kind: "replaceTag", path, from: a._tag, to: b._tag });
    return;
  }

  // value nodes (_str/_val)
  if (a._tag === STR_TAG || a._tag === VAL_TAG) {
    const av = a._content?.[0] as Primitive;
    const bv = b._content?.[0] as Primitive;
    if (!primEq(av, bv)) {
      outArr.push({ kind: "chgValue", path: pVSN(path, `/_${a._tag === STR_TAG ? "str" : "val"}`), nodeTag: a._tag, from: av, to: bv });
    }
    return;
  }

  // clusters
  if (a._tag === OBJ_TAG) { diffObj(pVSN(path, "/_obj"), a, b); return; }
  if (a._tag === ELEM_TAG) { diffElem(pVSN(path, "/_elem"), a, b); return; }
  if (a._tag === ARR_TAG)  { diffArr (pVSN(path, "/_arr"),  a, b); return; }
  if (a._tag === ROOT_TAG) {
    const ac = onlyClusterChild(a);
    const bc = onlyClusterChild(b);
    if (!ac || !bc) {
      // structural violation produces a replace
      outArr.push({ kind: "replaceNode", path: pVSN(path, "/_root"), from: a, to: b });
      return;
    }
    // descend into child cluster under /_root
    walkNode(pVSN(path, "/_root"), ac, bc);
    return;
  }

  // standard tag
  const here = pTag(path, a._tag);
  diffAttrs(here, a._attrs, b._attrs);
  diffMeta(here, a._meta, b._meta);

  const aKids = childrenNodes(a);
  const bKids = childrenNodes(b);

  if (aKids.length === 0 && bKids.length === 0) return;

  // single cluster child on both?
  const aSingle = aKids.length === 1 && isClusterTag(aKids[0]._tag) ? aKids[0] : null;
  const bSingle = bKids.length === 1 && isClusterTag(bKids[0]._tag) ? bKids[0] : null;

  if (aSingle && bSingle) {
    // descend into declared cluster
    const key = `/_${aSingle._tag.slice(1)}`; // '/_obj' | '/_elem' | '/_arr'
    walkNode(pVSN(here, key), aSingle, bSingle);
    return;
  }

  // Fallback: treat as element cluster semantics (ordered) if structure differs
  diffOrderedChildren(pVSN(here, "/_elem"), aKids, bKids);
}

/* ───────────────────────────── cluster diffs ─────────────────────────────── */

function diffObj(path: string, a: HsonNode_NEW, b: HsonNode_NEW): void {
  const ka = (childrenNodes(a)).map(n => n._tag).sort();
  const kb = (childrenNodes(b)).map(n => n._tag).sort();

  // maps for lookup
  const ma = new Map(childrenNodes(a).map(n => [n._tag, n]));
  const mb = new Map(childrenNodes(b).map(n => [n._tag, n]));

  let i = 0, j = 0;
  while (i < ka.length || j < kb.length) {
    const ta = ka[i];
    const tb = kb[j];
    if (tb === undefined || (ta !== undefined && ta < tb)) {
      outArr.push({ kind: "removeNode", path, node: ma.get(ta!)! });
      i++;
    } else if (ta === undefined || tb < ta) {
      outArr.push({ kind: "insertNode", path, node: mb.get(tb!)! });
      j++;
    } else {
      // same key: recurse
      walkNode(pProp(path, ta), ma.get(ta)!, mb.get(tb)!);
      i++; j++;
    }
  }
}

function diffElem(path: string, a: HsonNode_NEW, b: HsonNode_NEW): void {
  const A = childrenNodes(a);
  const B = childrenNodes(b);
  diffOrderedChildren(path, A, B);
}

function diffArr(path: string, a: HsonNode_NEW, b: HsonNode_NEW): void {
  const A = childrenNodes(a).map(unwrapII); // be tolerant if _ii leaked
  const B = childrenNodes(b).map(unwrapII);
  diffOrderedChildren(path, A, B);
}

function diffOrderedChildren(path: string, A: HsonNode_NEW[], B: HsonNode_NEW[]): void {
  const max = Math.max(A.length, B.length);
  for (let i = 0; i < max; i++) {
    const a = A[i];
    const b = B[i];
    if (a && !b) {
      outArr.push({ kind: "removeNode", path: pIdx(path, i), index: i, node: a });
    } else if (!a && b) {
      outArr.push({ kind: "insertNode", path: pIdx(path, i), index: i, node: b });
    } else if (a && b) {
      if (a._tag !== b._tag) {
        outArr.push({ kind: "replaceNode", path: pIdx(path, i), index: i, from: a, to: b });
      } else {
        walkNode(pIdx(path, i), a, b);
      }
    }
  }
}

/* ───────────────────────────── helpers ───────────────────────────────────── */

function onlyClusterChild(n: HsonNode_NEW): HsonNode_NEW | null {
  const kids = childrenNodes(n);
  if (kids.length !== 1) return null;
  const c = kids[0];
  return isClusterTag(c._tag) ? c : null;
}