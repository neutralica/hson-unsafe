import { HsonNode } from "../../types-consts";
import { NODE_ELEMENT_MAP, STR_TAG, VAL_TAG } from "../../types-consts/constants";
import { HTML_NS, SVG_NS } from "../node-utils/node-from-svg.utils";

const LEAF_TAGS = new Set([STR_TAG, VAL_TAG, /* future-proofing? */ "_num", "_bool", "_null"]);
// builder.ts (or wherever create_live_tree lives)

// NEW: single source of truth for node → DOM
export function build_element(node: HsonNode, parentNs: string = HTML_NS): Element | Text {
  // 1. leafs → text nodes, never recurse into their _content
  if (LEAF_TAGS.has(node._tag)) {
    const raw = Array.isArray(node._content) ? node._content[0] : node._content;
    const text = raw != null ? String(raw) : "";
    return document.createTextNode(text);
  }

  // 2. namespace resolution
  let ns = parentNs;
  const tag = node._tag;

  if (tag === "svg") ns = SVG_NS;
  if (tag === "foreignObject") ns = HTML_NS;

  const el =
    ns === HTML_NS
      ? document.createElement(tag)
      : document.createElementNS(ns, tag);

  // 3. attributes (keep names as-is – important for viewBox)
  if (node._attrs) {
    for (const [k, v] of Object.entries(node._attrs)) {
      if (v === "" || v === null || v === undefined) continue;
      el.setAttribute(k, String(v));
    }
  }

  // 4. children
  const kids = node._content ?? [];
  for (const child of kids) {
    if (typeof child !== "object" || child === null || !("_tag" in child)) {
      el.appendChild(document.createTextNode(String(child)));
      continue;
    }
    el.appendChild(build_element(child, ns));
  }

  // !!! TODO BUG ERROR
  // the casting here is not correct and could bite us later but satisfies type checking for now
  NODE_ELEMENT_MAP.set(node, el as HTMLElement);
  return el;
}

// THIS is what LiveTree uses to build the detached DOM tree for a branch
export function create_live_tree(rootNode: HsonNode): void {
  // Detached branch case: root is often a real tag (e.g. "svg", "div").
  // For the transform pipeline you may still have a "_root" wrapper, but
  // for LiveTree branches like fromHTML(svgHTML) it's just "svg".
  if (rootNode._tag === "_root") {
    const kids = rootNode._content ?? [];
    for (const child of kids) {
      if (typeof child === "object" && child !== null && "_tag" in child) {
        build_element(child as HsonNode, HTML_NS);
      }
    }
    // Optionally map _root to something if you rely on it:
    // NODE_ELEMENT_MAP.set(rootNode, document.documentElement ?? document.body);
  } else {
    build_element(rootNode, HTML_NS);
  }
}
