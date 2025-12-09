import { hson } from "../../../hson";
import { HsonNode } from "../../../types-consts";
import { TagName } from "../../../types-consts/tree.types";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
import { LiveTree2 } from "../livetree2";
import { makeTreeSelector, TreeSelector } from "../tree-selector";

// what `tree.create` looks like:
export type LiveTreeCreateHelper = {
  // per-tag sugar: tree.create.div(index?)
  [K in HtmlTag]: (index?: number) => LiveTree2;
} & {
  // batch version: tree.create.tags(["div","span"], index?)
  tags(tags: TagName[], index?: number): TreeSelector;
};

export type HtmlTag =
  "div" |
  "span" |
  "p" |
  "section" |
  "ul" |
  "li" |
  "button" |
  "header" |
  "footer" |
  "main";


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

export function makeCreateHelper(_tree: LiveTree2): LiveTreeCreateHelper {
  function makeOne(tag: TagName): LiveTree2 {
    const html = `<${tag}></${tag}>`;

    const parsed = hson
      .fromTrustedHtml(html)
      .toHSON()
      .parse();

    const root0: HsonNode = Array.isArray(parsed) ? parsed[0] : parsed;
    const [root] = unwrap_root_elem(root0);

    return new LiveTree2(root);
  }

  const helper: LiveTreeCreateHelper = {
    tags(tags: TagName[]): ReturnType<typeof makeTreeSelector> {
      const branches = tags.map(t => makeOne(t));
      return makeTreeSelector(branches);
    },
  } as LiveTreeCreateHelper;

  // dot-sugar: tree.create.div(), tree.create.span(), …
  for (const tag of HTML_TAGS) {
    (helper as any)[tag] = () => makeOne(tag);
  }

  return helper;
}