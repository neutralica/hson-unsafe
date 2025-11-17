// escape-text-segments.util.ts

/**
 * Escape only text nodes (outside of <tags ...>).
 * - Replaces bare "&" (not already an entity) with "&amp;"
 * - Replaces "<" with "&lt;" and ">" with "&gt;" in text
 * - Leaves markup and attribute values untouched (handles quotes inside tags)
 */
export function escape_text(input: string): string {
  let out = "";
  let i = 0, n = input.length;
  let inTag = false;
  let quote: '"' | "'" | null = null;

  const escapeText = (chunk: string) =>
    chunk
      .replace(/&(?!#\d+;|#x[0-9A-Fa-f]+;|[a-zA-Z][\w.-]*;)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // XML NameStartChar (very simplified) + specials
  const isTagStarter = (c: string | undefined) =>
    !!c && (c === ":" || c === "_" || /[A-Za-z]/.test(c) || c === "!" || c === "?" || c === "/");

  while (i < n) {
    if (!inTag) {
      let j = i;
      while (j < n) {
        if (input[j] === "<" && isTagStarter(input[j + 1])) break; 
        j++;
      }
      if (j > i) out += escapeText(input.slice(i, j));
      if (j < n) { inTag = true; out += "<"; i = j + 1; } else { i = j; }
    } else {
      let j = i;
      while (j < n) {
        const c = input[j]!;
        if (quote) { if (c === quote) quote = null; j++; continue; }
        if (c === '"' || c === "'") { quote = c as '"' | "'"; j++; continue; }
        if (c === ">") { j++; inTag = false; break; }
        j++;
      }
      out += input.slice(i, j);
      i = j;
    }
  }
  return out;
}