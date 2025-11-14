// nodd-from-dom.utils.ts

import { HsonNode } from "../../types-consts";
import { STR_TAG } from "../../types-consts/constants";


// CHANGED: tiny helper once, reuse everywhere
export const SVG_NS = "http://www.w3.org/2000/svg";
export const HTML_NS = "http://www.w3.org/1999/xhtml";
export const isSvgMarkup = (s: string) => /^<\s*svg[\s>]/i.test(s);

// NEW: DOM → HSON (namespace-aware)
export function node_from_svg(el: Element): HsonNode {
  const tag = el.tagName; // keep case if your engine expects exact; or `toLowerCase()`
  const attrs: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (a.name==='viewBox'||a.name==='viewbox'){console.log('VIEW BOX: ', a.name)}
    attrs[a.name] = a.value;
  }
  const kids: HsonNode[] = [];
  el.childNodes.forEach(n => {
    if (n.nodeType === Node.ELEMENT_NODE) kids.push(node_from_svg(n as Element));
    else if (n.nodeType === Node.TEXT_NODE && n.nodeValue) {
      kids.push({ _tag: STR_TAG, _content: [n.nodeValue], _attrs: {}, _meta: {} } as HsonNode);
    }
  });
  return {
    _tag: tag.toLowerCase(),               // align to your HSON tag scheme
    _attrs: attrs,
    _content: kids.length ? kids : [],
    _meta: { }       
  } as HsonNode;
}
