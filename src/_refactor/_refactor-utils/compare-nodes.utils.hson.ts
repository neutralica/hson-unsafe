import { Primitive } from "../../core/types-consts/core.types.hson";
import { HsonAttrs, HsonFlags, HsonMeta, HsonNode } from "../../types-consts/node.types.hson";
import { canonicalize } from "../../utils/canonicalize.utils.hson";
import { camel_to_kebab } from "../../utils/serialize-css.utils.hson";

/* stable stringify with lexicographic key order */
function stable_stringify(x: unknown): string {
  return JSON.stringify(x, (_k, v) => v, 2) /* spacer just for readability */
    .split("\n")
    .map(line => line) /* no-op hook */
    .join("\n");
}

/* normalize style to a stable object */
function normalize_style(
  s: string | Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!s) return undefined;

  let obj: Record<string, string> = {};
  if (typeof s === "string") {
    // naive parse: key:value; pairs
    for (const decl of s.split(";")) {
      const [kRaw, vRaw] = decl.split(":");
      const k = kRaw?.trim(); const v = vRaw?.trim();
      if (k) obj[k] = v ?? "";
    }
  } else {
    obj = { ...s };
  }

  // Kebab-case + lower-case keys; stable order
  const out: Record<string, string> = {};
  for (const k of Object.keys(obj).sort((a, b) => camel_to_kebab(a).localeCompare(camel_to_kebab(b)))) {
    out[camel_to_kebab(k)] = obj[k];
  }
  return out;
}

/* normalize attrs with stable key order; style normalized to object */
function normalize_attrs(attrs: HsonAttrs | undefined): Record<string, Primitive> {
  if (!attrs) return {};
  const tmp: Record<string, Primitive> = { ...attrs };

  if ("style" in tmp) {
    const norm = normalize_style(tmp["style"] as any);
    if (norm) tmp["style"] = JSON.parse(JSON.stringify(norm)) as any;
  }

  const out: Record<string, Primitive> = {};
  for (const k of Object.keys(tmp).sort()) out[k] = tmp[k];
  return out;
}

/* collects a unified _attrs for BOTH models (OLD & NEW) */
function collect_attrs(n: HsonNode): Record<string, Primitive> {
  const out: Record<string, Primitive> = {};

  /* _NEW: top-level _attrs wins */
  const aNew = (n as any)._attrs as Record<string, Primitive> | undefined;
  if (aNonEmpty(aNew)) {
    for (const k of Object.keys(aNew!).sort()) out[k] = aNew![k];
  }

  /*  _OLD: merge _meta.attrs where keys not already present */
  const meta: any = (n as any)._meta;
  const aOld = meta?.attrs as Record<string, Primitive> | undefined;
  if (aNonEmpty(aOld)) {
    for (const k of Object.keys(aOld!).sort()) if (!(k in out)) out[k] = aOld![k];
  }

  // OLD: merge flags → equality-style attrs (key="key") when not present
  const flags = meta?.flags as unknown;
  if (Array.isArray(flags)) {
    for (const f of flags) {
      if (typeof f === "string") {
        if (!(f in out)) out[f] = f;
      } else if (f && typeof f === "object") {
        // tolerate object-y flags: {disabled:true}
        for (const k of Object.keys(f).sort()) if (!(k in out)) out[k] = String((f as any)[k]) as any;
      }
    }
  }

  return normalize_attrs(out);

  function aNonEmpty(a?: Record<string, Primitive>) {
    return a && Object.keys(a).length > 0;
  }
}

/* normalize flags to a sorted array of strings */
function normalize_flags(flags: HsonFlags | undefined): string[] {
  if (!flags) return [];
  const out: string[] = [];
  for (const f of flags) {
    if (typeof f === "string") out.push(f);
    else if (f && typeof f === "object") {
      const pairs = Object.keys(f).sort().map(k => `${k}=${String((f as any)[k])}`);
      out.push(...pairs);
    }
  }
  out.sort();
  return out;
}

/* convert OLD meta to a stable, json-serializable shape */
function normalize_meta(meta: HsonMeta | undefined) {
  return {
    ...(typeof (meta as any)?.["data-index"] !== "undefined" ? { "data-index": String((meta as any)["data-index"]) } : {}),
    ...(typeof (meta as any)?.["data-quid"] !== "undefined" ? { "data-quid": String((meta as any)["data-quid"]) } : {}),
  };
}

/* normalize a node recursively into plain json with stable ordering */
function normalize_node(n: HsonNode | Primitive): any {
 if (n === null || typeof n !== "object") return n;
  const tag = (n as HsonNode)._tag;
  const meta = normalize_meta((n as HsonNode)._meta);
  const attrs = collect_attrs(n as HsonNode);
  const content = (n as HsonNode)._content?.map(c => normalize_node(c)) ?? [];
  return { _tag: tag, _attrs: attrs, _meta: meta, _content: content };

}

/* equality: structural, order-insensitive for attrs/flags */
export function equal_old_nodes(a: HsonNode, b: HsonNode): boolean {
  const A = normalize_node(a);
  const B = normalize_node(b);
  return canonicalize(A) === canonicalize(B);
}


/* optional: collect a small diff path when not equal (best-effort) */
export function diff_old_nodes(a: HsonNode, b: HsonNode, limit = 10): string[] {
  const A = normalize_node(a);
  const B = normalize_node(b);
  const diffs: string[] = [];

  function walk(x: any, y: any, path: string) {
    if (diffs.length >= limit) return;
    const tx = typeof x, ty = typeof y;
    if (tx !== ty) { diffs.push(`${path}: type ${tx} != ${ty}`); return; }
    if (x === null || y === null) { if (x !== y) diffs.push(`${path}: ${x} != ${y}`); return; }
    if (tx !== "object") { if (x !== y) diffs.push(`${path}: ${x} != ${y}`); return; }

    /* arrays */
    if (Array.isArray(x) || Array.isArray(y)) {
      if (!Array.isArray(x) || !Array.isArray(y)) { diffs.push(`${path}: array vs non-array`); return; }
      if (x.length !== y.length) diffs.push(`${path}.length: ${x.length} != ${y.length}`);
      const len = Math.min(x.length, y.length);
      for (let i = 0; i < len && diffs.length < limit; i++) walk(x[i], y[i], `${path}[${i}]`);
      return;
    }

    /* objects: compare sorted keys */
    const kx = Object.keys(x).sort();
    const ky = Object.keys(y).sort();
    const all = Array.from(new Set([...kx, ...ky])).sort();
    for (const k of all) {
      if (!(k in x)) { diffs.push(`${path}.${k}: missing in A`); continue; }
      if (!(k in y)) { diffs.push(`${path}.${k}: missing in B`); continue; }
      walk(x[k], y[k], `${path}.${k}`);
      if (diffs.length >= limit) return;
    }
  }

  walk(A, B, "$");
  return diffs;
}