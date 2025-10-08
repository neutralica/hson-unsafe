// make-string.utils.ts

import { is_Node } from "./node-guards.new.utils";
import { HsonNode, HsonAttrs, HsonMeta } from "../types-consts/node.new.types";

/** Pretty-print any value with stable, node-friendly key order. */
export function make_string_pretty(value: unknown, indent = 2): string {
  return JSON.stringify(canon(value), null, indent);
}

/** Backward-compatible alias if you already use make_string everywhere */
export const make_string = make_string_pretty;

// ---- internals ----

function canon(v: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (Array.isArray(v)) return v.map(x => canon(x, seen));

  if (v && typeof v === "object") {
    // Avoid cycles just in case (shouldn’t happen for your nodes, but safe)
    if (seen.has(v as object)) return "[[Circular]]";
    seen.add(v as object);

    // HSON node? Use node ordering.
    if (is_Node(v)) return orderNode(v as HsonNode, seen);

    // Generic object: sort keys alphabetically (stable output)
    return orderPlainObject(v as Record<string, unknown>, seen);
  }

  // Primitive
  return v;
}

function orderNode(n: HsonNode, seen: WeakSet<object>) {
  const out: any = {};

  // 1) canonical node-key order
  out._tag = n._tag;

  // 2) _attrs (sorted keys; style object also sorted)
  if (n._attrs && Object.keys(n._attrs).length) {
    out._attrs = orderAttrs(n._attrs);
  }

  // 3) _meta (sorted keys)
  if (n._meta && Object.keys(n._meta).length) {
    out._meta = orderMeta(n._meta);
  }

  // 4) _content (recursively canonicalized)
  if (Array.isArray(n._content) && n._content.length) {
    out._content = n._content.map(c => canon(c, seen));
  }

  return out;
}

function orderAttrs(a: HsonAttrs) {
  const out: any = {};
  for (const k of Object.keys(a).sort()) {
    const v = (a as any)[k];
    if (k === "style" && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = orderStyleObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function orderStyleObject(s: Record<string, unknown>) {
  const out: any = {};
  for (const k of Object.keys(s).sort()) out[k] = s[k];
  return out;
}

function orderMeta(m: HsonMeta) {
  const out: any = {};
  // If you want certain meta keys first, prioritize them here:
  const priority = ["data-_quid", "data-_index"];
  const keys = [
    ...priority.filter(k => k in (m as any)),
    ...Object.keys(m).sort().filter(k => !priority.includes(k)),
  ];
  for (const k of keys) out[k] = (m as any)[k];
  return out;
}

function orderPlainObject(obj: Record<string, unknown>, seen: WeakSet<object>) {
  const out: any = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = canon(obj[k], seen);
  }
  return out;
}
