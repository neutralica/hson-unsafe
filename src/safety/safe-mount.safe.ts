// client/safe-mount.ts
// CHANGED: use DOMPurify to sanitize any untrusted HTML before mounting.
// Assumes DOMPurify included via bundler (es module)
import DOMPurify from "dompurify";
// packages/hson-secure/src/policy.ts
export const ALLOWED_TAGS = [
  "a","p","div","span","strong","em","ul","ol","li","br","hr",
  "img","h1","h2","h3","h4","h5","h6"
] as const;

export const ALLOWED_ATTR = [
  "href","src","srcset","sizes","alt","title","id","class",
  "role","aria-label","aria-hidden","data-*","target","rel","loading","decoding"
] as const;

export const ALLOWED_URI_REGEX = /^(?:https?:|mailto:|tel:|data:image\/)/i;

// convenience: attach rel to target=_blank later in a post-pass

/* Create a safe mount function that accepts raw HSON-compiled HTML.
   It sanitizes the string, parses into a detached <template>, then
   appends the children into the target element. */
export function safeMountHtml(rawHtml: string, into: HTMLElement): void {
  // sanitize the raw HTML string to remove scripts, on* handlers, dangerous urls
  const cleanHtml: string = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ["style", "onerror", "onclick", "onload", "on*"],
    // keep only safe URL protocols
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/)/i
  });

  // Place sanitized HTML into a detached <template> element (inert until appended)
  const t: HTMLTemplateElement = document.createElement("template");
  t.innerHTML = cleanHtml;

  // Move children into destination in one operation
  // (this avoids incremental attachment and prevents half-adopted markup)
  const frag: DocumentFragment = t.content;
  into.appendChild(frag);
}
