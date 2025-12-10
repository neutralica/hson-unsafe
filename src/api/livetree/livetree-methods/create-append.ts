import { hson } from "../../../hson";
import { HsonNode } from "../../../types-consts";
import { TagName } from "../../../types-consts/tree.types";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
import { LiveTree } from "../livetree";
import { makeTreeSelector, TreeSelector } from "../tree-selector";

 /* overloads  */
export function createAppend2(this: LiveTree, tag: TagName, index?: number): LiveTree;
export function createAppend2(this: LiveTree, tags: TagName[], index?: number): TreeSelector;
/*  implementation */
export function createAppend2(
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
  return makeTreeSelector(created); // matches overload #2
}