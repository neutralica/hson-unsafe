// utils/sanitize-html.utils.ts
import DOMPurify from "dompurify";

/** Broad but finite HTML5 base list; extend if you use more. */
export const ALLOWED_TAGS: string[] = [
  "a","abbr","address","article","aside","b","bdi","bdo","blockquote","br","button",
  "caption","code","col","colgroup","data","dd","del","details","dfn","div","dl","dt",
  "em","figcaption","figure","footer","h1","h2","h3","h4","h5","h6","header","hr",
  "i","img","input","ins","kbd","label","li","main","mark","nav","ol","p","picture",
  "pre","q","rp","rt","ruby","s","samp","section","small","span","strong","sub","summary",
  "sup","table","tbody","td","tfoot","th","thead","time","tr","u","ul","var"
];

export const ALLOWED_ATTR: string[] = [
  "href","src","srcset","sizes","alt","title","id","class",
  "role","aria-label","aria-hidden","aria-expanded","aria-controls",
  "target","rel","loading","decoding","data-*"
];

/** Never permitted regardless of discovery. */
export const FORBID_TAGS_HARD: Set<string> = new Set([
  "script","style","iframe","object","embed","link","meta","base","form",
  "svg","math","video","audio" // keep blocked unless you add a strict SVG subset
]);

/** Your project’s legit custom UI tags (not required—discovery will see them anyway). */
export const UI_CUSTOM_TAGS: string[] = [
  "sky-back","cloudy-sky","cloud","hson-data","hson-input","hson-output","live-component"
];

export const ALLOWED_URI_REGEX: RegExp =
  /^(?:https?:|mailto:|tel:|data:image\/)/i;

/** Discover all tag names in a string without attaching to DOM. */
export function discoverTags(html: string): Set<string> {
  const tpl = document.createElement("template");
  tpl.innerHTML = html; // inert parse
  const seen = new Set<string>();
  const walk = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      seen.add((node as Element).tagName.toLowerCase());
    }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  };
  walk(tpl.content);
  return seen;
}

/** Build the per-call ADD_TAGS by union(discovered, UI tags) minus hard forbids. */
export function buildAddTags(html: string): string[] {
  const disc = discoverTags(html);
  for (const t of Array.from(disc)) {
    if (FORBID_TAGS_HARD.has(t)) disc.delete(t);
  }
  // Union + de-dup; include your known UI tags up front
  return [...new Set([...UI_CUSTOM_TAGS, ...disc])];
}

/** One-shot sanitize with discovery-driven allowlist. */
export function sanitize_external(html: string): string {
  const ADD_TAGS = buildAddTags(html);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],     // pass mutable copies
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ADD_TAGS,                            // discovery result
    FORBID_ATTR: ["style","onerror","onclick","onload","on*","srcdoc"],
    ALLOWED_URI_REGEXP: ALLOWED_URI_REGEX,
    KEEP_CONTENT: false
  });
}
