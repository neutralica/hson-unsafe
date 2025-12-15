// css-prop-utils.ts

import { kebab_to_camel } from "../primitive-utils/kebab-to-camel.util";

// CHANGED: keep this table small and explicit.
const CSS_PROP_ALIASES: Readonly<Record<string, string>> = {
  float: "cssFloat",
};

// CHANGED: vendor prefixes to CSSOM-style names.
const VENDOR_PREFIX_ALIASES: Readonly<Record<string, string>> = {
  "-webkit-": "Webkit",
  "-moz-": "Moz",
  "-ms-": "ms",
  "-o-": "O",
};

/**
 * Accept camelCase, kebab-case, vendor-ish forms, and custom props.
 * Return canonical CSSOM-style camelCase (or `--var` unchanged).
 */
export function normalize_css_prop_key(raw: string): string {
  const p = raw.trim();
  if (p === "") return "";

  // custom properties stay as-is
  if (p.startsWith("--")) return p;

  // CHANGED: aliases first (treat input case-insensitively)
  const lower = p.toLowerCase();
  const aliased = CSS_PROP_ALIASES[lower];
  if (aliased) return aliased;

  // vendor-ish: -webkit-foo-bar -> WebkitFooBar
  for (const [prefix, head] of Object.entries(VENDOR_PREFIX_ALIASES)) {
    if (lower.startsWith(prefix)) {
      const rest = p.slice(prefix.length);
      return head + kebab_to_camel(rest).replace(/^[a-z]/, ch => ch.toUpperCase());
    }
  }

  // already camel-ish (no dashes)
  if (!p.includes("-")) return p;

  // kebab -> camel
  return kebab_to_camel(p);
}