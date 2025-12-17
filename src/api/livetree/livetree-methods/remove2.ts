// remove2.ts

import { drop_quid } from "../../../quid/data-quid.quid";
import { HsonNode } from "../../../types-consts/node.types";
import { _DATA_QUID } from "../../../types-consts/constants";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers";
import { LiveTree } from "../livetree";
import { CssManager } from "./css-manager";
import { is_Node } from "../../../utils/node-utils/node-guards";

/**
 * Recursively convert a HSON node into a JSON-shaped `JsonValue`.
 *
 * This is the core structural converter behind `serialize_json`. It walks
 * the HSON IR, interprets VSN tags, and reconstructs the nearest equivalent
 * JavaScript value (object, array, or primitive).
 *
 * Tag-by-tag semantics:
 *
 * - `_root`:
 *   - Must have exactly one child.
 *   - That child is taken as the true data cluster; `_root` itself is not
 *     reflected in the JSON surface.
 *
 * - `_arr`:
 *   - Expects `_content` to be a list of `_ii` index nodes.
 *   - Each `_ii` is unwrapped and converted; the resulting array preserves
 *     element order and ignores the index metadata.
 *
 * - `_obj`:
 *   - If `_content` has a single child that is one of:
 *       `_str`, `_val`, `_arr`, `_obj`, `_elem`
 *     then this wrapper is treated as transparent and the child’s JSON
 *     representation is returned directly. This mirrors the “cluster”
 *     behavior in the rest of the system.
 *   - Otherwise:
 *     - Each child is treated as a property node:
 *       - The tag name (`propNode._tag`) becomes the object key.
 *       - The first child of that property node is converted recursively
 *         and used as the value.
 *     - Produces a plain `JsonObj` whose keys correspond to these tag names.
 *
 * - `_str` / `_val`:
 *   - Return their single primitive payload directly:
 *     - `_str` → string
 *     - `_val` → number | boolean | null
 *
 * - `_elem`:
 *   - Represents “element cluster” semantics in JSON form.
 *   - Each child in `_content` is converted recursively.
 *   - The result is wrapped as `{ "_elem": [ ...items ] }`, so that element
 *     mode remains distinguishable at the JSON layer.
 *
 * - `_ii`:
 *   - Index wrapper used inside `_arr`.
 *   - Must contain exactly one child node.
 *   - Unwrapped and converted directly via `jsonFromNode` on that child.
 *
 * - Default branch (standard or user-defined tag, e.g. `"div"`, `"recipe"`):
 *   - Build a property object of the shape:
 *       `{ [tag]: <payload>, _attrs?, _meta? }`
 *   - Content:
 *       - No children  → `{ [tag]: "" }` (empty string payload)
 *       - One child    → `{ [tag]: jsonFromNode(child) }`
 *       - Multiple children → error (a standard tag is not allowed to have
 *         multiple content clusters at this stage).
 *   - Attributes:
 *       - If `_attrs` is present and non-empty, it is attached as `_attrs`
 *         on the same object, merged with any existing `_attrs`.
 *   - Meta:
 *       - If `_meta` is present and non-empty, it is attached as `_meta`
 *         without further filtering; meta is preserved as-is in JSON mode.
 *
 * Safety / guardrails:
 * - Rejects any tag that starts with `_` but is not a known VSN
 *   (`EVERY_VSN`), to avoid leaking unknown control tags into JSON.
 * - For `_root`, `_arr`, `_ii`, `_elem`, and cluster shapes, checks that
 *   structural expectations are met (e.g., `_root` has exactly one child,
 *   `_ii` has exactly one child, etc.).
 *
 * @param $node - The HSON node to convert.
 * @returns A `JsonValue` (object, array, or primitive) suitable for
 *   `JSON.stringify`.
 * @throws If the node shape violates HSON invariants or contains unknown
 *   VSN-like tags.
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
 * Remove this `LiveTree` node from both the DOM and the HSON model.
 *
 * Behavior:
 * 1. CSS cleanup
 *    - Uses `collectQuidsForSubtree(this.node)` to find all QUIDs in the
 *      DOM subtree rooted at this node.
 *    - Invokes `CssManager.invoke().clearQuid(q)` for each QUID, ensuring
 *      that any QUID-scoped CSS rules are removed when the subtree is
 *      detached.
 *
 * 2. DOM + mapping teardown
 *    - Calls `detach_node_deep(node)` to:
 *      - Remove the mapped DOM elements,
 *      - Tear down any associated listeners,
 *      - Clear `NODE_ELEMENT_MAP` entries for the subtree.
 *
 * 3. IR-side identity cleanup
 *    - Calls `drop_quid(node)` on the root node to clear its QUID in the
 *      HSON model, preventing dangling identity references after removal.
 *
 * 4. Structural removal from HSON tree
 *    - Uses `this.getHostRoots()` to locate the logical root of the
 *      containing tree.
 *    - Calls `pruneNodeFromRoot(root, node)` to physically remove the node
 *      from the `_content` arrays within the HSON graph.
 *
 * Postcondition:
 * - The `LiveTree` instance still holds a reference to the now-detached
 *   node (an orphan in the IR), so further mutations affect only the
 *   in-memory model, not the DOM.
 *
 * Contract:
 * - Never returns a new `LiveTree`; always returns `this` for fluent
 *   chaining.
 *
 * @returns This `LiveTree` instance, after its node has been removed from
 *   the DOM and pruned from the host HSON tree.
 */
export function remove_self(this: LiveTree): LiveTree {
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

/**
 * Recursively remove a specific HSON node from a root subtree.
 *
 * Algorithm:
 * - Walks the `_content` array of `root` depth-first.
 * - For each child:
 *   - Skips non-node entries.
 *   - If the child is the `target`, removes it in-place via `splice` and
 *     returns `true`.
 *   - Otherwise, recurses into that child. If any recursive call returns
 *     `true`, bubbles that `true` up and stops further traversal.
 *
 * Characteristics:
 * - Purely structural: operates only on the `_content` arrays; does not
 *   touch DOM, QUIDs, or maps.
 * - Returns a boolean to indicate whether the target was found and removed.
 *
 * Use cases:
 * - Internal helper for `remove_self`, or any operation that needs to
 *   excise a node from an existing HSON tree while preserving relatives.
 *
 * @param root - The HSON node to search within (treated as the current
 *   subtree root).
 * @param target - The exact `HsonNode` instance to remove.
 * @returns `true` if the target was found and removed somewhere under
 *   `root`; `false` if the target does not occur in this subtree.
 */
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