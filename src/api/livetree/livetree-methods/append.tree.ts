// // append.tree.ts


// import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
// import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
// import { STR_TAG, ELEM_TAG } from "../../../types-consts/constants";
// import { HsonNode } from "../../../types-consts/node.types";
// import { create_live_tree } from "../create-live-tree.tree";
// import { LiveTree } from "../live-tree-class.tree";
// import { CREATE_NODE } from "../../../types-consts/factories";
// import { make_string } from "../../../utils/primitive-utils/make-string.nodes.utils";
// import { _throw_transform_err } from "../../../utils/sys-utils/throw-transform-err.utils";
// import { getElementForNode } from "../../../utils/tree-utils/node-map-helpers.utils";


// export function append(
//   this: LiveTree,
//   $content: Partial<HsonNode> | string | LiveTree,
//   index?: number,                          // CHANGED
// ): LiveTree {
//   const selectedNodes = (this as any).selectedNodes as HsonNode[];

//   let nodesToAppend: HsonNode[];
//   if (typeof $content === "string") {
//     nodesToAppend = [CREATE_NODE({ _tag: STR_TAG, _content: [$content] })];
//   } else if ($content instanceof LiveTree) {
//     // inherit host roots so later remove() knows how to prune
//     $content.adoptRoots((this as any).rootRefs ?? []);
//     const sourceNodes = $content.sourceNode();
//     nodesToAppend = unwrap_root_elem(sourceNodes);
//   } else if (is_Node($content)) {
//     nodesToAppend = unwrap_root_elem($content);
//   } else {
//     _throw_transform_err("[ERR] invalid content provided", "append", make_string($content));
//   }

//   for (const targetNode of selectedNodes) {
//     if (!targetNode._content) targetNode._content = [];

//     // [UNCHANGED IDEA] find existing _elem container; if none, create an EMPTY one
//     //                  (do not lift/migrate existing siblings into it)
//     let containerNode: HsonNode | undefined = undefined;
//     const firstChild = targetNode._content[0];
//     if (is_Node(firstChild) && firstChild._tag === ELEM_TAG) {
//       containerNode = firstChild;
//     } else {
//       containerNode = CREATE_NODE({ _tag: ELEM_TAG, _content: [] }); // empty
//       // prepend container once; leave existing content as-is after it
//       targetNode._content = [containerNode, ...targetNode._content];
//     }

//     if (!containerNode._content) containerNode._content = [];
//     const childContent = containerNode._content;

//     // --- HSON INSERTION LOGIC -----------------------------------------
//     if (typeof index === "number") {
//       // CHANGED: use normalizeIndex into the container's children
//       const insertIx = normalizeIndex(index, childContent.length);
//       childContent.splice(insertIx, 0, ...nodesToAppend);
//     } else {
//       // CHANGED: default behavior is the old "append at end"
//       childContent.push(...nodesToAppend);
//     }

//     // --- DOM SYNC ------------------------------------------------------
//     const liveElement = getElementForNode(targetNode);
//     if (liveElement) {
//       const domChildren = Array.from(liveElement.childNodes);

//       if (typeof index === "number") {
//         // CHANGED: attempt to mirror the same insertion index in the DOM
//         let insertIx = normalizeIndex(index, domChildren.length);

//         for (const newNode of nodesToAppend) {
//           const dom = create_live_tree(newNode); // Node (Element or Fragment)
//           const refNode = domChildren[insertIx] ?? null;
//           liveElement.insertBefore(dom, refNode);
//           insertIx += 1;
//         }
//       } else {
//         // old behavior: append at the end
//         for (const newNode of nodesToAppend) {
//           const dom = create_live_tree(newNode); // Node (Element or Fragment)
//           liveElement.appendChild(dom);
//         }
//       }
//     }
//   }
//   return this;
// }

// export function nextFrame(): Promise<void> {
//   // resolves right before the next paint
//   return new Promise(resolve => requestAnimationFrame(() => resolve()));
// }

// export async function after_paint(): Promise<void> {
//   // ensures at least one paint between awaits
//   await nextFrame();
//   await nextFrame();
// }

// function normalizeIndex(index: number, length: number): number {
//   if (length <= 0) return 0;

//   // non-negative: clamp into [0, length]
//   if (index >= 0) {
//     return index > length ? length : index;
//   }

//   // negative index: -1 => length - 1, -2 => length - 2, etc.
//   const fromEnd = length + index; // index is negative
//   if (fromEnd < 0) return 0;
//   return fromEnd;
// }
