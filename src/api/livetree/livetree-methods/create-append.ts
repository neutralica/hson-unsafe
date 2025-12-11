import { hson } from "../../../hson";
import { HsonNode } from "../../../types-consts/node.types";
import { TagName } from "../../../types-consts/livetree.types";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
import { LiveTree } from "../livetree";
import { make_tree_selector } from "../tree-selector";
import { TreeSelector } from "../../../types-consts/livetree.types";

/**
 * Create one or more new element nodes as children of this `LiveTree`'s node
 * and return handles to the created subtrees.
 *
 * Overloads:
 * - When called with a single `TagName`, returns a `LiveTree` anchored at
 *   the newly created element.
 * - When called with an array of `TagName`, returns a `TreeSelector`
 *   containing a `LiveTree` for each created element.
 *
 * Implementation details:
 * - Ensures `this.node` exists (throws if the tree is unbound).
 * - For each tag:
 *   - Builds a minimal HTML string (`<tag></tag>`).
 *   - Parses it through `hson.fromTrustedHtml(...).toHSON().parse()` to get
 *     an HSON subtree.
 *   - Wraps the parsed root in a temporary `LiveTree` and appends it via
 *     `this.append(...)`, which performs graph + DOM mutation.
 *   - Unwraps the `_elem` wrapper with `unwrap_root_elem` to obtain the
 *     “real” children that were attached.
 *   - Wraps each appended child in a `LiveTree`, calls `adoptRoots` so it
 *     shares the same host roots as `this`, and collects these trees.
 * - If `index` is provided, it is used as the initial insertion index and
 *   incremented by the number of appended children so that subsequent tags
 *   are inserted after previous ones.
 *
 * @this LiveTree - The anchor tree whose node will receive the new elements.
 * @param tagOrTags - A single tag name or an array of tag names to create.
 * @param index - Optional insertion index among the anchor node's children;
 *                applied to the first created element and advanced for each
 *                subsequent element when multiple tags are provided.
 * @returns A `LiveTree` when a single tag is created, or a `TreeSelector`
 *          wrapping all created `LiveTree` instances when multiple tags are
 *          created.
 */ 
/* overloads  */
export function createAppend(this: LiveTree, tag: TagName, index?: number): LiveTree;
export function createAppend(this: LiveTree, tags: TagName[], index?: number): TreeSelector;
/*  implementation */
export function createAppend(
  this: LiveTree,
  tagOrTags: TagName | TagName[],
  index?: number,
): LiveTree | TreeSelector {
  const tags: TagName[] = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags];

  // ensure there *is* an anchor node; throws if tree is unbound
  void this.node;

  const created: LiveTree[] = [];
  let insertIx: number | undefined = index;

  for (const t of tags) {
    const html = `<${t}></${t}>`;

    const parsed = hson
      .fromTrustedHtml(html)
      .toHSON()
      .parse();

    const root: HsonNode = Array.isArray(parsed) ? parsed[0] : parsed;

    // temporary branch for append()
    const branch = new LiveTree(root);

    // do the actual graph+DOM mutation
    this.append(branch, insertIx);

    // unwrap the `_elem` wrapper to get the “real” children
    const appended = unwrap_root_elem(root);

    for (const child of appended) {
      const childTree = new LiveTree(child);
      childTree.adoptRoots(this.getHostRoots());
      created.push(childTree);
    }

    if (typeof insertIx === "number") {
      insertIx += appended.length;
    }
  }

  if (created.length === 1) {
    return created[0];           // matches overload #1
  }
  return make_tree_selector(created); // matches overload #2
}