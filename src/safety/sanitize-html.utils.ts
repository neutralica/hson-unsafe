// utils/sanitize-html.utils.ts
import DOMPurify from "dompurify";

/** Broad but finite HTML5 base list; extend if you use more. */
export const ALLOWED_TAGS: string[] = [
  "a", "abbr", "address", "article", "aside", "b", "bdi", "bdo", "blockquote", "br", "button",
  "caption", "code", "col", "colgroup", "data", "dd", "del", "details", "dfn", "div", "dl", "dt",
  "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr",
  "i", "img", "input", "ins", "kbd", "label", "li", "main", "mark", "nav", "ol", "p", "picture",
  "pre", "q", "rp", "rt", "ruby", "s", "samp", "section", "small", "span", "strong", "sub", "summary",
  "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var"
];

export const ALLOWED_ATTR: string[] = [
  "href", "src", "srcset", "sizes", "alt", "title", "id", "class",
  "role", "aria-label", "aria-hidden", "aria-expanded", "aria-controls",
  "target", "rel", "loading", "decoding", "data-*"
];

/** Never permitted regardless of discovery. */
export const FORBID_TAGS_HARD: Set<string> = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "base", "form",
  "svg", "math", "video", "audio" // keep blocked unless you add a strict SVG subset
]);


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
  return [...new Set([...disc])];
}

/** One-shot sanitize with discovery-driven allowlist. */
export function sanitize_external(html: string): string {
  const ADD_TAGS = buildAddTags(html);
  DOMPurify.addHook("uponSanitizeAttribute", (node) => {
    const el = node as unknown as Element;
    const name: string = (node as any).attrName;
    const value: string = (node as any).attrValue;

    // Drop all inline styles explicitly (DOMPurify also blocks by FORBID_ATTR)
    if (name === "style") { (node as any).keepAttr = false; return; }

    // Drop srcdoc
    if (name === "srcdoc") { (node as any).keepAttr = false; return; }

    // Harden URL-bearing attributes against the allowed regex
    if (/^(href|src|xlink:href|poster)$/i.test(name)) {
      if (!ALLOWED_URI_REGEX.test(value)) { (node as any).keepAttr = false; return; }
    }

    // srcset: drop whole attribute if any candidate is unsafe
    if (/^srcset$/i.test(name)) {
      const parts = value.split(/\s*,\s*/);
      for (let i = 0; i < parts.length; i++) {
        const url = (parts[i].trim().split(/\s+/)[0] || "");
        if (!ALLOWED_URI_REGEX.test(url)) { (node as any).keepAttr = false; return; }
      }
    }

    // rel hygiene for target=_blank
    if (name === "target" && value === "_blank") {
      const current = el.getAttribute("rel") || "";
      const set = new Set(current.split(/\s+/).filter(Boolean));
      set.add("noopener"); set.add("noreferrer");
      el.setAttribute("rel", Array.from(set).join(" "));
    }
  });

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ADD_TAGS,
    FORBID_TAGS: Array.from(FORBID_TAGS_HARD),        // ensure the hard block wins
    FORBID_ATTR: ["style", "srcdoc"],                 // remove "on*" (no globbing)
    ALLOWED_URI_REGEXP: ALLOWED_URI_REGEX,
    ALLOW_DATA_ATTR: true,                            // replaces "data-*"
    KEEP_CONTENT: false,
    WHOLE_DOCUMENT: false,
  });
}