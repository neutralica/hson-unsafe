// remove2.ts

import { drop_quid } from "../../../quid/data-quid.quid";
import { HsonNode } from "../../../types-consts";
import { _DATA_QUID } from "../../../types-consts/constants";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node.tree.utils";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers.utils";
import { LiveTree } from "../livetree";
import { CssManager } from "./css-manager";
import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";

/**
 * Collect all QUIDs for a node's DOM subtree:
 * - the node itself (if mounted),
 * - all descendants with data-_quid.
 */
function collectQuidsForSubtree(rootNode: HsonNode): Set<string> {
  const rootEl = element_for_node(rootNode) as HTMLElement | undefined;
  if (!rootEl) return new Set(); // not mounted → nothing to clear

  const elements: HTMLElement[] = [
    rootEl,
    ...Array.from(
      rootEl.querySelectorAll<HTMLElement>(`[${_DATA_QUID}]`),
    ),
  ];

  const quids = new Set<string>();
  for (const el of elements) {
    const q = el.getAttribute(_DATA_QUID);
    if (q) quids.add(q);
  }

  return quids;
}

/**
 * Removes this LiveTree2's node from the HSON tree and the DOM (if mounted).
 *
 * Behavior:
 * - Clears any QUID-scoped CSS rules for the node + its DOM descendants.
 * - Detaches the node subtree from DOM + internal maps.
 * - Leaves the LiveTree2 pointing at the (now detached) node; further
 *   mutations will only affect the orphaned model, not the DOM.
 */
export function remove2(this: LiveTree): LiveTree {
  const node = this.node; // single-node invariant

  // 1) Clear QUID-scoped CSS for the DOM subtree (if any).
  const css = CssManager.invoke();
  const quids = collectQuidsForSubtree(node);
  for (const q of quids) {
    css.clearQuid(q);
  }

  // 2) Tear down subtree: listeners + DOM + NODE_ELEMENT_MAP, etc.
  detach_node_deep(node);

  // 3) Drop any QUID(s) on the root node itself (IR-side cleanup).
  drop_quid(node);

  // 4) Remove this node from the HSON model under its host root
  const root = this.getHostRoots(); // or getHostRoots(), depending on what you named it
  if (root) {
    pruneNodeFromRoot(root, node);
  }

  // optional: you *could* also null out nodeRef here if you ever want
  // remove() to make the LiveTree "dead" in a stricter sense.

  return this;
}

function pruneNodeFromRoot(root: HsonNode, target: HsonNode): boolean {
  const content = root._content;
  if (!Array.isArray(content)) return false;

  for (let i = 0; i < content.length; i += 1) {
    const child = content[i];
    if (!is_Node(child)) continue;

    if (child === target) {
      content.splice(i, 1);
      return true;
    }

    if (pruneNodeFromRoot(child, target)) {
      return true;
    }
  }
  return false;
}