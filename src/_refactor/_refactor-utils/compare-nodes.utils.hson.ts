import { Primitive } from "../../core/types-consts/core.types.hson";
import { HsonAttrs, HsonFlags, HsonMeta, HsonNode } from "../../types-consts/node.types.hson";
import { canonicalize } from "../../utils/canonicalize.utils.hson";
import { is_Node } from "../../utils/node-guards.utils.hson";
import { camel_to_kebab } from "../../utils/serialize-css.utils.hson";

const RESERVED_META = new Set(["data-index", "data-quid"]);
const IS_reservedMeta = (k: string) =>
  RESERVED_META.has(k) || k.startsWith("data-_");

/* stable stringify with lexicographic key order */
function stable_stringify(x: unknown): string {
  return JSON.stringify(x, (_k, v) => v, 2) /* spacer just for readability */
    .split("\n")
    .map(line => line) /* no-op hook */
    .join("\n");
}

function _peek(x: any, y: any, path: string) {
  try {
    // log a compact view of the first mismatch
    console.warn('[shadow-peek]', path, {
      A: typeof x, Ax: JSON.stringify(x),
      B: typeof y, By: JSON.stringify(y),
    });
  } catch {}
}


/* normalize style to a stable object */
function normalize_style(
  s: string | Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!s) return undefined;

  // parse string → object
  let obj: Record<string, string> = {};
  if (typeof s === "string") {
    for (const decl of s.split(";")) {
      if (!decl.trim()) continue;
      const i = decl.indexOf(":");
      const key = (i >= 0 ? decl.slice(0, i) : decl).trim();
      const val = (i >= 0 ? decl.slice(i + 1) : "").trim();
      if (key) obj[key] = val;
    }
  } else {
    obj = { ...s };
  }

  // Coalesce by hyphenless alias; prefer hyphenated when both exist
  const byAlias = new Map<string, { kebab: string; val: string }>();
  for (const rawKey of Object.keys(obj)) {
    const kebab = camel_to_kebab(rawKey);     // e.g., 'font-size' or 'fontsize'
    const alias = kebab.replace(/-/g, "");    // e.g., 'fontsize'
    const val = obj[rawKey];

    const prev = byAlias.get(alias);
    if (!prev || (prev.kebab.indexOf("-") === -1 && kebab.indexOf("-") !== -1)) {
      byAlias.set(alias, { kebab, val });
    }
  }

  // Emit with the alias as the canonical key (hyphenless) so both sides match
  const out: Record<string, string> = {};
  Array.from(byAlias.entries())
    .sort((a, b) => a[0].localeCompare(b[0])) // sort by alias
    .forEach(([alias, { val }]) => (out[alias] = val));
  return out;
}

function normalize_meta(n: HsonNode): Record<string, string> {
  const meta: any = (n as any)._meta ?? {};
  const topAttrs: any = (n as any)._attrs ?? {};
  const oldMetaAttrs: any = meta?.attrs ?? {};

  // helper: get canonical meta value from multiple legacy slots
  const pick = (canonKey: "data-index" | "data-quid"): string | undefined => {
    // 1) canonical location (NEW)
    if (meta[canonKey] != null) return String(meta[canonKey]);

    // 2) legacy attr names (OLD): data-_<name>
    const underscored = "data-_" + canonKey.slice("data-".length); // e.g., "data-_index"
    if (topAttrs[underscored] != null) return String(topAttrs[underscored]);
    if (oldMetaAttrs[underscored] != null) return String(oldMetaAttrs[underscored]);

    return undefined;
  };

  const out: Record<string, string> = {};
  const di = pick("data-index");
  if (di !== undefined) out["data-index"] = di;
  const dq = pick("data-quid");
  if (dq !== undefined) out["data-quid"] = dq;
  return out;
}

/* normalize attrs with stable key order; style normalized to object */
function normalize_attrs(attrs: HsonAttrs | undefined): Record<string, Primitive> {
  if (!attrs) return {};
  const tmp: Record<string, Primitive> = { ...attrs };

  for (const k of Object.keys(attrs)) {
    if (!IS_reservedMeta(k)) tmp[k] = attrs[k];
  }

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
  if (NON_void(aNew)) {
    for (const k of Object.keys(aNew!).sort()) {
      if (!IS_reservedMeta(k)) out[k] = aNew![k];

    }
  }

  /*  _OLD: merge _meta.attrs where keys not already present */
  const meta: any = (n as any)._meta;
  const aOld = meta?.attrs as Record<string, Primitive> | undefined;
  if (NON_void(aOld)) {
    for (const k of Object.keys(aOld!).sort()) {
      if (!IS_reservedMeta(k) && (!(k in out))) {
        out[k] = aOld![k]

      };
    }
  }

  // OLD: merge flags → equality-style attrs (key="key") when not present
  const flags = meta?.flags as unknown;
  if (Array.isArray(flags)) {
    for (const f of flags) {
      if (typeof f === "string") {
        if (!IS_reservedMeta(f) && !(f in out)) {
          out[f] = f;
        }
      } else if (f && typeof f === "object") {
        // tolerate object-y flags: {disabled:true}
        for (const k of Object.keys(f).sort())
          if (!IS_reservedMeta(k) && !(k in out)) {
            out[k] = String((f as any)[k]) as any;

          }
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(out, "style")) {
    const norm = normalize_style(out["style"] as any);  // use the kebab-preserving version
    if (norm) (out as any)["style"] = norm as any;
  }

  return normalize_attrs(out);

  function NON_void(a?: Record<string, Primitive>) {
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
function normalize_meta_OLD(meta: HsonMeta | undefined) {
  return {
    ...(typeof (meta as any)?.["data-index"] !== "undefined" ? { "data-index": String((meta as any)["data-index"]) } : {}),
    ...(typeof (meta as any)?.["data-quid"] !== "undefined" ? { "data-quid": String((meta as any)["data-quid"]) } : {}),
  };
}

/* normalize a node recursively into plain json with stable ordering */
function normalize_node(n: HsonNode | Primitive): any {
  if (!is_Node(n)) return n;
  const tag = (n as HsonNode)._tag;
  const meta = normalize_meta(n);
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
    if (tx !== ty) {
       _peek(x, y, path);
      diffs.push(`${path}: type ${tx} != ${ty}`);
      return;
    }
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