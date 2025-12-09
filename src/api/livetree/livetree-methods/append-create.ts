// // append-create.types.ts

// import { hson } from "../../../hson";
// import { HsonNode } from "../../../types-consts";
// import { TagName } from "../../../types-consts/tree.types";
// import { LiveTree } from "../live-tree-class.tree";

// // Change this list as you like; it just needs to match HTML_TAGS below.
// export type HtmlTag =
//     | "div"
//     | "span"
//     | "p"
//     | "section"
//     | "ul"
//     | "li"
//     | "button"
//     | "header"
//     | "footer"
//     | "main";

// // What appendCreate(tag) returns: a handle with .at(index)
// export interface AppendCreateHandle {
//     at(index: number): LiveTree;
// }

// // Callable + dot-sugar helper
// export interface AppendCreateFn {
//     (tag: HtmlTag | string): AppendCreateHandle;
// }



// //  the tag list backing the chained sugar `appendCreate.div`, etc.
// const HTML_TAGS: HtmlTag[] = [
//     "div",
//     "span",
//     "p",
//     "section",
//     "ul",
//     "li",
//     "button",
//     "header",
//     "footer",
//     "main",
// ];

// //  normalize whatever sourceNode() gives us into an array of HsonNode
// function normalizeRootNodes(root: HsonNode | HsonNode[] | undefined): HsonNode[] {
//     if (!root) {
//         return [];
//     }
//     if (Array.isArray(root)) {
//         return root;
//     }
//     return [root];
// }


// // CHANGED: result type for the chained call
// export interface AppendCreateResult {
//     at(index: number): LiveTree;
// }
// // Keep this as-is:
// export interface AppendCreateResult {
//     at(index: number): LiveTree;
// }

// // ✅ function overload signatures:
// export function appendCreate(
//     this: LiveTree,
//     tag: TagName | TagName[],
// ): AppendCreateResult;

// export function appendCreate(
//     this: LiveTree,
//     tag: TagName | TagName[],
//     index: number,
// ): LiveTree;

// // ✅ single implementation that satisfies both overloads
// export function appendCreate(
//     this: LiveTree,
//     tag: TagName | TagName[],
//     index?: number,
// ) {
//     const tags: TagName[] = Array.isArray(tag) ? tag : [tag];

//     const applyAt = (ix?: number): LiveTree => {
//         const parents = this.sourceNode();

//         if (parents.length === 0) {
//             throw new Error("appendCreate(): no selected nodes to append into");
//         }

//         const html = tags.map((t) => `<${t}></${t}>`).join("");

//         const branch = hson
//           .fromTrustedHtml(html)
//             .liveTree()
//             .asBranch();

//         // uses your new indexed append
//         this.append(branch, ix);

//         return this;
//     };

//     if (typeof index === "number") {
//         // overload #2: (tag, index) -> LiveTree
//         return applyAt(index);
//     }

//     // overload #1: (tag) -> { at(index): LiveTree }
//     return {
//         at: (ix: number): LiveTree => applyAt(ix),
//     };
// }


// // what `.at()` returns (always the same tree)
// export interface AppendCreateResult {
//   at(index: number): LiveTree;
// }

// // the helper is:
// //   - callable: appendCreate('div'), appendCreate(['div','span'], -1)
// //   - has dot props: appendCreate.div.at(-1)
// export type AppendCreateHelper = {
//   (tag: TagName | TagName[], index?: number): AppendCreateResult | LiveTree;
// } & {
//   [K in HtmlTag]: AppendCreateResult;
// };

// // small internal worker that actually does the work
// function runAppendCreate(
//   tree: LiveTree,
//   tag: TagName | TagName[],
//   index?: number,
// ): AppendCreateResult | LiveTree {
//   const tags: TagName[] = Array.isArray(tag) ? tag : [tag];

//   const applyAt = (ix?: number): LiveTree => {
//     const html = tags.map((t) => `<${t}></${t}>`).join("");

//     const branch = hson
//       .fromTrustedHtml(html)
//       .liveTree()
//       .asBranch();

//     // assumes append(content, index?) exists
//     tree.append(branch, ix);
//     return tree;
//   };

//   if (typeof index === "number") {
//     // direct mode: appendCreate('div', -1)
//     return applyAt(index);
//   }

//   // chainable mode: appendCreate('div').at(-1)
//   return {
//     at(ix: number): LiveTree {
//       return applyAt(ix);
//     },
//   };
// }

// // factory: build a helper bound to a specific LiveTree
// export function makeAppendCreateHelper(tree: LiveTree): AppendCreateHelper {
//   const core = (tag: TagName | TagName[], index?: number): AppendCreateResult | LiveTree =>
//     runAppendCreate(tree, tag, index);

//   const helper = core as AppendCreateHelper;

//   // attach dot-sugar properties: appendCreate.div.at(-1)
//   for (const tag of HTML_TAGS) {
//     helper[tag] = {
//       at(ix: number): LiveTree {
//         // delegate to the same worker, bound to this tree + tag
//         return runAppendCreate(tree, tag, ix) as LiveTree;
//       },
//     };
//   }

//   return helper;
// }