// remove2.ts

import { drop_quid } from "../../../quid/data-quid.quid";
import { HsonNode } from "../../../types-consts";
import { _DATA_QUID } from "../../../types-consts/constants";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node.tree.utils";
import { getElementForNode } from "../../../utils/tree-utils/node-map-helpers.utils";
import { LiveTree2 } from "../../livetree-2/livetree2";
import { CssManager } from "./css-manager";

/**
 * Collect all QUIDs for a node's DOM subtree:
 * - the node itself (if mounted),
 * - all descendants with data-_quid.
 */
function collectQuidsForSubtree(rootNode: HsonNode): Set<string> {
  const rootEl = getElementForNode(rootNode) as HTMLElement | undefined;
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
export function remove2(this: LiveTree2): LiveTree2 {
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

  // NOTE:
  // We *don't* null out this.nodeRef here. The tree still "points" at the
  // now-detached node. That matches the old behavior where the selection
  // survives remove(), but is no longer wired to DOM.
  // If later you want stricter semantics, this is the place to flip it.

  return this;
}