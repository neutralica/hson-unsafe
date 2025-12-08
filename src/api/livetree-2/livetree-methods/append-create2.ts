// append-create.types.ts

import { hson } from "../../../hson";
import { HsonNode } from "../../../types-consts";
import { TagName } from "../../../types-consts/tree.types";
import { LiveTree2 } from "../livetree2";

// Change this list as you like; it just needs to match HTML_TAGS below.
export type HtmlTag =
  | "div"
  | "span"
  | "p"
  | "section"
  | "ul"
  | "li"
  | "button"
  | "header"
  | "footer"
  | "main";

// What appendCreate(tag) returns: a handle with .at(index)
export interface AppendCreateHandle {
  at(index: number): LiveTree2;
}

// Callable + dot-sugar helper
export interface AppendCreateFn {
  (tag: HtmlTag | string): AppendCreateHandle;
}



// comment: the tag list backing the chained sugar `appendCreate.div`, etc.
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

// comment: normalize whatever sourceNode() gives us into an array of HsonNode
function normalizeRootNodes(root: HsonNode | HsonNode[] | undefined): HsonNode[] {
  if (!root) {
    return [];
  }
  if (Array.isArray(root)) {
    return root;
  }
  return [root];
}


// CHANGED: result type for the chained call
export interface AppendCreateResult {
  at(index: number): LiveTree2;
}
// Keep this as-is:
export interface AppendCreateResult {
  at(index: number): LiveTree2;
}

// ✅ function overload signatures:
export function createAppend2(
  this: LiveTree2,
  tag: TagName | TagName[],
): AppendCreateResult;

export function createAppend2(
  this: LiveTree2,
  tag: TagName | TagName[],
  index: number,
): LiveTree2;
// ✅ single implementation that satisfies both overloads
export function createAppend2(
  this: LiveTree2,
  tag: TagName | TagName[],
  index?: number,
) {
  const tags: TagName[] = Array.isArray(tag) ? tag : [tag];

  const applyAt = (ix?: number): LiveTree2 => {
    // Touching this.node will throw if there is no anchor node,
    // which is exactly what we want in the “no root” case.
    // If you don’t want the explicit read, you can drop this line; append2()
    // will hit this.node internally anyway.
    void this.node;

    const html = tags.map((t) => `<${t}></${t}>`).join("");

    const parsed = hson
      .fromTrustedHtml(html)
      .toHSON()
      .parse();

    // `parsed` is HsonNode | HsonNode[]. LiveTree2's ctor can handle that
    // as long as you left it typed that way; if you narrowed it to HsonNode
    // only, normalize here:
    //   const root = Array.isArray(parsed) ? parsed[0] : parsed;
    //   const branch = new LiveTree2(root);
    const branch = new LiveTree2(parsed as HsonNode);

    // uses your new indexed append2
    this.append(branch, ix);

    return this;
  };

  if (typeof index === "number") {
    // overload #2: (tag, index) -> LiveTree2
    return applyAt(index);
  }

  // overload #1: (tag) -> { at(index): LiveTree2 }
  return {
    at: (ix: number): LiveTree2 => applyAt(ix),
  };
}

// what `.at()` returns (always the same tree)
export interface AppendCreateResult {
  at(index: number): LiveTree2;
}

// the helper is:
//   - callable: appendCreate('div'), appendCreate(['div','span'], -1)
//   - has dot props: appendCreate.div.at(-1)
export type AppendCreateHelper = {
  (tag: TagName | TagName[], index?: number): AppendCreateResult | LiveTree2;
} & {
  [K in HtmlTag]: AppendCreateResult;
};

// small internal worker that actually does the work
function runAppendCreate(
  tree: LiveTree2,
  tag: TagName | TagName[],
  index?: number,
): AppendCreateResult | LiveTree2 {
  const tags: TagName[] = Array.isArray(tag) ? tag : [tag];

  const applyAt = (ix?: number): LiveTree2 => {
    const html = tags.map((t) => `<${t}></${t}>`).join("");

    const string = hson
      .fromTrustedHtml(html)
      .toHSON()
      .parse();
    const branch = new LiveTree2(string)
    // assumes append(content, index?) exists
    tree.append(branch, ix);
    return tree;
  };

  if (typeof index === "number") {
    // direct mode: appendCreate('div', -1)
    return applyAt(index);
  }

  // chainable mode: appendCreate('div').at(-1)
  return {
    at(ix: number): LiveTree2 {
      return applyAt(ix);
    },
  };
}

// factory: build a helper bound to a specific LiveTree
export function makeAppendCreateHelper(tree: LiveTree2): AppendCreateHelper {
  const core = (tag: TagName | TagName[], index?: number): AppendCreateResult | LiveTree2 =>
    runAppendCreate(tree, tag, index);

  const helper = core as AppendCreateHelper;

  // attach dot-sugar properties: appendCreate.div.at(-1)
  for (const tag of HTML_TAGS) {
    helper[tag] = {
      at(ix: number): LiveTree2 {
        // delegate to the same worker, bound to this tree + tag
        return runAppendCreate(tree, tag, ix) as LiveTree2;
      },
    };
  }

  return helper;
}