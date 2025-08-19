// clone-node.utils.hson.ts

export function clone_node<T>(node: T): T {
  // eslint-disable-next-line no-undef
  if (typeof (globalThis as any).structuredClone === 'function') {
    // eslint-disable-next-line no-undef
    return (globalThis as any).structuredClone(node);
  }
  return JSON.parse(JSON.stringify(node)) as T;
}
