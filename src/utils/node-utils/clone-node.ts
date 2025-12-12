// clone-node.utils.hson.ts

/**
 * Normalize an input node by removing an outer `<_root>` wrapper and ensuring
 * the result is always a structural “cluster” node (`_obj`, `_arr`, or `_elem`).
 *
 * Rules:
 * - If `node` is not `<_root>`, it is returned unchanged.
 * - If `<_root>` has no child nodes, returns an empty `_obj` cluster.
 * - If `<_root>` has exactly one child:
 *   - If that child is already `_obj`, `_arr`, or `_elem`, return it.
 *   - Otherwise, box the single child inside a new `_obj` cluster to keep a
 *     structural container as the canonical result.
 * - If `<_root>` has multiple child nodes, wrap them in a new `_obj` cluster.
 *
 * This is mainly used to enforce “structural-at-the-top” invariants so callers
 * can treat the returned value as a cluster node without special-casing.
 *
 * @param node - Input node that may be a `<_root>` wrapper.
 * @returns A cluster node (`_obj`, `_arr`, or `_elem`) suitable for downstream processing.
 */
export function clone_node<T>(node: T): T {
  if (typeof (globalThis as any).structuredClone === 'function') {
    return (globalThis as any).structuredClone(node);
  }
  return JSON.parse(JSON.stringify(node)) as T;
}
