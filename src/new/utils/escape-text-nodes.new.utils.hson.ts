// escape-text-segments.util.ts

/**
 * Escape only TEXT nodes (outside of <tags ...>).
 * - Replaces bare "&" (not already an entity) with "&amp;"
 * - Replaces "<" with "&lt;" and ">" with "&gt;" in text
 * - Leaves markup and attribute values untouched (handles quotes inside tags)
 */
export function escape_text_nodes(input: string): string {
  let out = "";
  let i = 0;
  const n = input.length;
  let inTag = false;
  let quote: '"' | "'" | null = null;

  // Escape bare ampersands that aren't entities
  const escapeText = (chunk: string) =>
    chunk
      .replace(/&(?!#\d+;|#x[0-9A-Fa-f]+;|[a-zA-Z][\w.-]*;)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  while (i < n) {
    if (!inTag) {
      // accumulate text until next "<"
      let j = i;
      while (j < n && input[j] !== "<") j++;
      if (j > i) out += escapeText(input.slice(i, j));
      if (j < n && input[j] === "<") {
        inTag = true;
        out += "<";
        i = j + 1;
      } else {
        i = j;
      }
    } else {
      // inside a tag; copy verbatim until the matching ">"
      let j = i;
      while (j < n) {
        const c = input[j] as string;
        if (quote) {
          if (c === quote) quote = null;
          j++;
          continue;
        }
        if (c === '"' || c === "'") {
          quote = c as '"' | "'";
          j++;
          continue;
        }
        if (c === ">") {
          j++;
          inTag = false;
          break;
        }
        j++;
      }
      out += input.slice(i, j);
      i = j;
    }
  }
  return out;
}