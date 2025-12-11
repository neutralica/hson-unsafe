import { HsonNode } from "../../../types-consts/node.types";
import { FindWithById, HsonQuery } from "../../../types-consts/livetree.types";
import { parse_selector } from "../../../utils/tree-utils/parse-selector.utils";
import { LiveTree } from "../livetree";
import { make_tree_selector } from "../tree-selector";
import { TreeSelector } from "../../../types-consts/livetree.types";
import { search_nodes } from "./search2";


/**
 * Wrap a raw `HsonNode` in a new `LiveTree` that inherits the caller’s host root.
 *
 * Semantics:
 * - Constructs a new `LiveTree` over `node`.
 * - Copies the parent’s `hostRoot` via `adoptRoots(parent.getHostRoots())`
 *   so the new tree participates in the same “document root” context
 *   (for removal, grafting, etc.).
 *
 * Notes:
 * - Used by search helpers (`find` / `find_all_in_tree`) to ensure that
 *   returned child trees still know which root they belong to, even
 *   though they are focused on a single node.
 */
function wrapInChildTree(parent: LiveTree, node: HsonNode): LiveTree {
    return new LiveTree(node).adoptRoots(parent.getHostRoots());
}

/**
 * Build a `find` helper bound to a specific `LiveTree`.
 *
 * Surface:
 * - Callable as `find(query)` → `LiveTree | undefined`
 * - Augmented with:
 *   - `find.byId(id)`      → `LiveTree | undefined`
 *   - `find.must(query)`   → `LiveTree` (throws if no match)
 *   - `find.mustById(id)`  → `LiveTree` (throws if no match)
 *
 * Behavior:
 * - Converts string selectors via `parse_selector` into `HsonQuery`.
 * - Delegates to `search_nodes([tree.node], query, { findFirst: true })`,
 *   so the search is rooted at the current tree’s node (not global).
 * - Wraps the first matching `HsonNode` in a child `LiveTree` that
 *   inherits the parent’s host root (`wrapInChildTree`).
 *
 * Error semantics:
 * - `find(...)` and `find.byId(...)` return `undefined` when no match.
 * - `find.must(...)` and `find.mustById(...)` throw with a descriptive
 *   message including either the selector or a provided `label`.
 */
export function make_find_for(tree: LiveTree): FindWithById {
    const base = ((q: HsonQuery | string): LiveTree | undefined => {
        const query = typeof q === "string" ? parse_selector(q) : q;
        const found = search_nodes([tree.node], query, { findFirst: true });
        if (!found.length) return undefined;
        return wrapInChildTree(tree, found[0]); // ← changed
    }) as FindWithById;

    base.byId = (id: string): LiveTree | undefined =>
        base({ attrs: { id } });

    base.must = (q, label) => {
        const res = base(q);
        if (!res) {
            const desc = label ?? (typeof q === "string" ? q : JSON.stringify(q));
            throw new Error(`[LiveTree2.find.must] expected match for ${desc}`);
        }
        return res;
    };

    base.mustById = (id, label) => {
        const res = base.byId(id);
        if (!res) {
            const desc = label ?? `#${id}`;
            throw new Error(`[LiveTree2.find.mustById] expected element ${desc}`);
        }
        return res;
    };

    return base;
}

/**
 * Find *all* matching nodes under a `LiveTree` and return them as a `TreeSelector`.
 *
 * Semantics:
 * - Rooted search: delegates to `search_nodes([tree.node], query, { findFirst: false })`,
 *   so the traversal is confined to this tree’s subtree.
 * - For each matching `HsonNode`, constructs a child `LiveTree` via
 *   `wrapInChildTree`, preserving the original host root.
 * - Packs the resulting `LiveTree[]` into a `TreeSelector` via
 *   `make_tree_selector`, giving the caller broadcast helpers
 *   (`setAttrs`, `style`, `listen`, etc.).
 *
 * Selector handling:
 * - If `q` is a string, it is parsed via `parse_selector` into `HsonQuery`.
 * - If `q` is already an `HsonQuery`, it is used as-is.
 *
 * Return value:
 * - Always returns a `TreeSelector` (possibly empty). All mutation
 *   helpers on the selector are no-ops when the selection is empty.
 */
export function find_all_in_tree(tree: LiveTree, q: HsonQuery | string): TreeSelector {
    const query = typeof q === "string" ? parse_selector(q) : q;
    const found = search_nodes([tree.node], query, { findFirst: false });

    const trees = found.map(node => wrapInChildTree(tree, node)); // ← changed
    return make_tree_selector(trees);
}