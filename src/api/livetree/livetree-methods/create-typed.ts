import { hson } from "../../../hson";
import { HsonNode } from "../../../types-consts/node.types";
import { LiveTreeCreateHelper, TagName, TreeSelectorCreateHelper } from "../../../types-consts/livetree.types";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
import { LiveTree } from "../livetree";
import { make_tree_selector } from "../tree-selector";
import { TreeSelector } from "../../../types-consts/livetree.types";


/**
 * Supported HTML tag names for the built-in `tree.create.<tag>()` sugar.
 *
 * These tags are chosen to keep the helper small, predictable, and in line
 * with the subset of structural elements LiveTree tends to operate on.
 */
export type HtmlTag = keyof HTMLElementTagNameMap;
/**
 * Canonical list backing the dot-sugar creation functions on
 * `LiveTreeCreateHelper`.
 *
 * Each entry corresponds to a method added to the helper at runtime
 * (e.g., `helper.div()`, `helper.span()`, etc.).
 */

const HTML_TAGS: HtmlTag[] = [
  "div",
  "span",
  "p",
  "section",
  "ul",
  "li",
  "button",
  "header",
  "footer",
  "main",
];
/**
 * Construct the `.create` helper for a single `LiveTree` instance.
 *
 * Semantics:
 * - New elements are created as *children* of `tree.node`.
 * - HSON nodes are produced via the canonical HTML → HSON pipeline:
 *   `hson.fromTrustedHtml(html).toHSON().parse()`.
 * - Any `_elem` wrapper at the root is unwrapped via `unwrap_root_elem`,
 *   so created nodes are real element nodes, not virtual containers.
 * - For each call:
 *   - Per-tag methods (e.g. `tree.create.div(index?)`) create one or more
 *     element children and return a `LiveTree` anchored at the first new
 *     child created for that tag.
 *   - The batch form (`tree.create.tags([...], index?)`) creates children
 *     for each tag and returns a `TreeSelector` of all new children.
 *
 * Index semantics:
 * - `index` is interpreted as the insertion index in the current node's
 *   child list (after `_elem` unwrapping), consistent with your `append`
 *   behavior. When multiple tags are created in one call, the index is
 *   incremented by the number of children created so the next tag is
 *   inserted after the previous ones.
 *
 * @param tree - The `LiveTree` whose node will act as parent for all
 *               elements created via the helper.
 * @returns A `LiveTreeCreateHelper` bound to `tree`.
 */
export function make_tree_create(tree: LiveTree): LiveTreeCreateHelper {
  // Core worker that handles both single-tag and multi-tag creation.
  function createForTags(
    tagOrTags: TagName | TagName[],
    index?: number,
  ): LiveTree | TreeSelector {
    const tags: TagName[] = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags];

    // Ensure the tree has a bound node; mutators are allowed to throw if not.
    void tree.node;

    const created: LiveTree[] = [];
    let insertIx: number | undefined = index;

    for (const t of tags) {
      const html = `<${t}></${t}>`;

      const parsed = hson
        .fromTrustedHtml(html)
        .toHSON()
        .parse();

      const root0: HsonNode = Array.isArray(parsed) ? parsed[0] : parsed;

      // Temporary branch used only to drive append semantics.
      const branch = new LiveTree(root0);

      // Attach into the graph + DOM, respecting insertion index.
      tree.append(branch, insertIx);

      // unwrap `_elem` wrapper to get the real children that were appended.
      const appended = unwrap_root_elem(root0);

      for (const child of appended) {
        const childTree = new LiveTree(child);
        childTree.adoptRoots(tree.getHostRoots());
        created.push(childTree);
      }

      if (typeof insertIx === "number") {
        insertIx += appended.length;
      }
    }

    if (!Array.isArray(tagOrTags)) {
      // Single-tag case: return the first created child (should exist).
      if (!created.length) {
        throw new Error("[LiveTree.create] no children created");
      }
      return created[0];
    }

    // Multi-tag case: return a selector of all new children.
    return make_tree_selector(created);
  }

  const helper: LiveTreeCreateHelper = {
    // Batch creation: tree.create.tags(["div","span"], index?)
    tags(tags: TagName[], index?: number): TreeSelector {
      const result = createForTags(tags, index);
      return result as TreeSelector;
    },
  } as LiveTreeCreateHelper;

  // Per-tag sugar: tree.create.div(index?), tree.create.span(index?), …
  for (const tag of HTML_TAGS) {
    (helper as any)[tag] = (index?: number): LiveTree => {
      const result = createForTags(tag, index);
      return result as LiveTree;
    };
  }

  return helper;
}


/**
 * Construct the `.create` helper for a `TreeSelector`, providing the same
 * surface API as `LiveTree.create` but broadcasting across the selection.
 *
 * Semantics:
 * - For each `LiveTree` in `items`:
 *   - Forward to that tree's `.create` helper (e.g. `tree.create.div(index?)`).
 *   - Collect the returned `LiveTree`/`TreeSelector` handles for the newly
 *     created children.
 * - Flatten all created children into a single `TreeSelector` that becomes
 *   the result of each call.
 *
 * Index semantics:
 * - The optional `index` is interpreted *per parent tree*: each source tree
 *   uses the same insertion index relative to its own children. This keeps
 *   behavior predictable without coupling insert positions across different
 *   subtrees.
 *
 * @param items - The `LiveTree` instances comprising the selector.
 * @returns A `TreeSelectorCreateHelper` bound to those items.
 */
export function make_selector_create(items: LiveTree[]): TreeSelectorCreateHelper {
  const helper: TreeSelectorCreateHelper = {
    // Batch: selector.create.tags(["div","span"], index?)
    tags(tags: TagName[], index?: number): TreeSelector {
      const created: LiveTree[] = [];

      for (const tree of items) {
        // For each tree, delegate to its own create.tags()
        const childSelector = tree.create.tags(tags/* , index */); // omitted index until relevant
        created.push(...childSelector.toArray());
      }

      return make_tree_selector(created);
    },
  } as TreeSelectorCreateHelper;

  // Per-tag sugar: selector.create.div(index?), selector.create.span(index?), …
  for (const tag of HTML_TAGS) {
    (helper as any)[tag] = (index?: number): TreeSelector => {
      const created: LiveTree[] = [];

      for (const tree of items) {
        const childTree = tree.create[tag](/* index */);
        created.push(childTree);
      }

      return make_tree_selector(created);
    };
  }

  return helper;
}