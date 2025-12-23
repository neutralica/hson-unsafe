// remove2.ts

import { drop_quid } from "../../../quid/data-quid.quid";
import { HsonNode } from "../../../types-consts/node.types";
import { _DATA_QUID } from "../../../types-consts/constants";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers";
import { LiveTree } from "../livetree";
import { CssManager } from "./css-manager";
import { is_Node } from "../../../utils/node-utils/node-guards";
import { HsonQuery } from "hson-live/types";
import { search_nodes } from "./search";
import { parse_selector } from "../../../utils/tree-utils/parse-selector";

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
// CHANGED: new single cleanup primitive used by ALL removals.
// This is the “one site of the action”.
function detach_subtree(node: HsonNode): void {
  // 1) Clear QUID-scoped CSS for the DOM subtree (if any).
  const css = CssManager.invoke();
  const quids = collectQuidsForSubtree(node);
  for (const q of quids) css.clearQuid(q);

  // 2) Tear down subtree: listeners + DOM + NODE_ELEMENT_MAP, etc.
  detach_node_deep(node);

  // 3) Drop any QUID(s) on the root node itself (IR-side cleanup).
  drop_quid(node);
}
// remove.ts (or wherever remove_livetree lives)

// ADDED: small helper so remove_livetree can be counted reliably
function is_attached(node: HsonNode): boolean {
  // CHANGED: replace this with your real invariant.
  // Common options:
  // - node._parent exists
  // - hostRoot traversal can find it (slower)
  // - nodeRef still resolves, etc.
  return element_for_node(node)!== undefined;
}

// CHANGED: return number (0/1) instead of LiveTree
export function remove_livetree(this: LiveTree): number {
  const node = this.node;

  // ADDED: idempotent count behavior
  if (!is_attached(node)) return 0;

  // (existing)
  const css = CssManager.invoke();
  const quids = collectQuidsForSubtree(node);
  for (const q of quids) css.clearQuid(q);

  detach_node_deep(node);
  drop_quid(node);

  const root = this.getHostRoots();
  if (root) pruneNodeFromRoot(root, node);

  // CHANGED: return count
  return 1;
}

// CHANGED: remove_child delegates to detach_subtree per child
// and returns how many were removed (not `this`).
export function remove_child(this: LiveTree, query: HsonQuery | string): number {
  const parent = this.node;
  const kids = parent._content;
  if (!Array.isArray(kids) || kids.length === 0) return 0;

  const nodeKids = kids.filter(is_Node);
  if (nodeKids.length === 0) return 0;

  const q: HsonQuery = typeof query === "string" ? parse_selector(query) : query;
  const toRemove = search_nodes(nodeKids, q, { findFirst: false });
  if (!toRemove.length) return 0;

  // CHANGED: centralized cleanup
  for (const child of toRemove) detach_subtree(child);

  // Keep your Set-based filter (good).
  const removeSet = new Set(toRemove);
  const nextKids: typeof kids = [];
  for (const ch of kids) {
    if (is_Node(ch) && removeSet.has(ch)) continue;
    nextKids.push(ch);
  }
  parent._content = nextKids;

  return toRemove.length; // CHANGED
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