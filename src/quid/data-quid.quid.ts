// data-quid.quid.ts

import { HsonNode_NEW } from '../types-consts/node.new.types';
import { _DATA_QUID, ARR_TAG, ELEM_TAG, II_TAG, NODE_ELEMENT_MAP_NEW, OBJ_TAG, ROOT_TAG, STR_TAG, VAL_TAG } from '../types-consts/constants';

// Use type-only imports and .js specifiers to play nice with verbatimModuleSyntax

/** node <-> quid maps (WeakMap allows GC) */
const QUID_TO_NODE = new Map<string, HsonNode_NEW>();
const NODE_TO_QUID = new WeakMap<HsonNode_NEW, string>();

/** short, sortable-ish id; crypto if available, else timestamp+counter */
let _inc = 0;
function mk_quid(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  return `q-${Date.now().toString(36)}-${(_inc++).toString(36)}`;
}

/** Read quid from meta or registry */
export function get_quid(n: HsonNode_NEW): string | undefined {
  const q = n._meta?.[_DATA_QUID];
  if (typeof q === "string" && q) return q;
  return NODE_TO_QUID.get(n);
}

/** Ensure quid exists, persist in _meta, index both ways */
export function ensure_quid(n: HsonNode_NEW, opts?: { persist?: boolean }): string {
  const persist = !!opts?.persist;

  let q = get_quid(n);
  if (!q) q = mk_quid();

  // Always keep fast O(1) mappings in memory
  QUID_TO_NODE.set(q, n);
  NODE_TO_QUID.set(n, q);

  // Only decorate user data if asked
  if (persist) {
    (n._meta ??= {})[_DATA_QUID] = q;
  }

  return q;
}

/** O(1) lookup */
export function get_node_by_quid(q: string): HsonNode_NEW | undefined {
  return QUID_TO_NODE.get(q);
}

/** Re-index a node you’ve structurally replaced */
export function reindex_quid(n: HsonNode_NEW): void {
  const q = get_quid(n);
  if (!q) return;
  NODE_TO_QUID.set(n, q);
  QUID_TO_NODE.set(q, n);
}

/** Seed quids on standard tags only (by default) */
export function seed_quids(root: HsonNode_NEW, includeVSNs = false): void {
  const VSN = new Set<string>([ROOT_TAG,OBJ_TAG,ARR_TAG,ELEM_TAG,II_TAG,STR_TAG,VAL_TAG]);
  const stack: HsonNode_NEW[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    const isVSN = VSN.has(n._tag);
    if (includeVSNs || !isVSN) ensure_quid(n);
    const kids = n._content;
    if (Array.isArray(kids)) {
      for (const k of kids) {
        if (k && typeof k === "object" && "_tag" in k) stack.push(k as HsonNode_NEW);
      }
    }
  }
}

export { _DATA_QUID };

// --- NEW: drop_quid (removes both registry entries, and optionally _meta) ---
//  [CHANGED] added function
export function drop_quid(n: HsonNode_NEW, opts?: { scrubMeta?: boolean; stripDomAttr?: boolean }) {
  const q = get_quid(n);
  if (!q) return;

  // delete both directions
  QUID_TO_NODE.delete(q);
  NODE_TO_QUID.delete(n);

  // optional: remove from meta to avoid persistence
  if (opts?.scrubMeta && n._meta && _DATA_QUID in n._meta) {
    delete n._meta[_DATA_QUID];
  }

  // optional: strip DOM attribute if mounted
  if (opts?.stripDomAttr) {
    const el = NODE_ELEMENT_MAP_NEW.get(n as any); // avoid import loop by localizing this in one place if needed
    el?.removeAttribute('data-_quid');
  }
}

// --- NEW: has_quid (fast check to avoid re-seeding) ---
//  [CHANGED] added function
export function has_quid(n: HsonNode_NEW): boolean {
  return !!get_quid(n);
}
