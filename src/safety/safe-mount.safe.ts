// client/safe-mount.ts
import {  ALLOWED_URI_REGEX, sanitize_external } from "./sanitize-html.utils";


export function mount_html_safe(rawHtml: string, into: HTMLElement): void {
  const cleanHtml = sanitize_external(rawHtml); // discover → allow → sanitize
  const t = document.createElement("template");
  t.innerHTML = cleanHtml;          // inert parse
  into.appendChild(t.content);      // single adopt, no innerHTML writes
}

// safety/set-attr-safe.ts
const FORBID_ATTR = new Set(["style"]); // keep this strict for now
const URL_ATTR = new Set(["href", "src", "srcset", "sizes"]);

export function set_attrs_safe(el: Element, name: string, value: string): void {
  const n = name.toLowerCase();

  // Block event handlers and style entirely
  if (n.startsWith("on") || FORBID_ATTR.has(n)) return;

  if (URL_ATTR.has(n)) {
    // conservative srcset split
    const items = n === "srcset"
      ? value.split(",").map(p => (p.trim().split(/\s+/)[0] ?? ""))
      : [value.trim()];
    for (const url of items) {
      if (url && !ALLOWED_URI_REGEX.test(url)) return; // reject whole write
    }
    // extra: normalize rel for target=_blank links
    if (n === "href" && (el as HTMLAnchorElement).target === "_blank") {
      const a = el as HTMLAnchorElement;
      const rel = (a.rel || "").split(/\s+/);
      if (!rel.includes("noopener")) rel.push("noopener");
      if (!rel.includes("noreferrer")) rel.push("noreferrer");
      a.rel = rel.join(" ").trim();
    }
  }

  el.setAttribute(name, value);
}

// safety/create-element-safe.ts
const DANGEROUS_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "base",
  "form", "input", "video", "audio"
]);

export function create_el_safe(tagName: string): HTMLElement {
  const t = tagName.toLowerCase();
  if (DANGEROUS_TAGS.has(t)) {
    const el = document.createElement("_tag");
    set_attrs_safe(el, "name", tagName); // encode original
    return el;
  }
  return document.createElement(tagName);
}

