// data-quid.quid.ts

import { HsonNode } from '../types-consts/node.types';
import { _DATA_QUID} from '../types-consts/constants';
import { getElementForNode } from '../utils/tree-utils/node-map-helpers.utils';

// Use type-only imports and .js specifiers to play nice with verbatimModuleSyntax

/** node <-> quid maps (WeakMap allows GC) */
const QUID_TO_NODE = new Map<string, HsonNode>();
const NODE_TO_QUID = new WeakMap<HsonNode, string>();

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
export function get_quid(n: HsonNode): string | undefined {
  const q = n._meta?.[_DATA_QUID];
  if (typeof q === "string" && q) return q;
  return NODE_TO_QUID.get(n);
}

/** Ensure quid exists, persist in _meta, index both ways */
export function ensure_quid(n: HsonNode, opts?: { persist?: boolean }): string {
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
export function get_node_by_quid(q: string): HsonNode | undefined {
  return QUID_TO_NODE.get(q);
}

/** Re-index a node that was structurally replaced */
export function reindex_quid(n: HsonNode): void {
  const q = get_quid(n);
  if (!q) return;
  NODE_TO_QUID.set(n, q);
  QUID_TO_NODE.set(q, n);
}

export { _DATA_QUID };

// --- drop_quid (removes both registry entries, and optionally _meta) ---
export function drop_quid(n: HsonNode, opts?: { scrubMeta?: boolean; stripDomAttr?: boolean }) {
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
    const el = getElementForNode(n as any); // avoid import loop by localizing this in one place if needed
    el?.removeAttribute(_DATA_QUID);
  }
}

// --- has_quid (fast check to avoid re-seeding) ---
export function has_quid(n: HsonNode): boolean {
  return !!get_quid(n);
}
