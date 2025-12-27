// clone-node.ts

/**
 * Deep-clone a value using `structuredClone` when available.
 *
 * Fallbacks:
 * - Uses JSON round-trip cloning when `structuredClone` is not present.
 *
 * @param node - Value to clone.
 * @returns A deep copy of the input value.
 */
export function clone_node<T>(node: T): T {
  if (typeof (globalThis as any).structuredClone === 'function') {
    return (globalThis as any).structuredClone(node);
  }
  return JSON.parse(JSON.stringify(node)) as T;
}
