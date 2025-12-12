// lex-text-piece.ts

/*******
 * Lex and normalize a raw text fragment, detecting and unwrapping quotes.
 *
 * Purpose:
 * - Used during tokenization / parsing to normalize text values while
 *   preserving whether the original source was explicitly quoted.
 * - Provides a single place where escape handling rules are centralized.
 *
 * Behavior:
 * - Trims surrounding whitespace.
 * - If the result is empty, returns `{ text: "", quoted: false }`.
 * - Detects matching leading/trailing quotes (`"` or `'`).
 * - If unquoted:
 *   - Returns the trimmed text as-is with `quoted: false`.
 * - If quoted:
 *   - Removes the outer quotes.
 *   - Sets `quoted: true`.
 *
 * Escape handling:
 * - Double-quoted strings (`"`):
 *   - Prefer full JSON semantics via `JSON.parse`, enabling support for
 *     escape sequences like `\"`, `\\`, `\n`, `\r`, `\t`, and `\uXXXX`.
 *   - Falls back to a minimal unescape pass if JSON parsing fails.
 * - Single-quoted strings (`'`):
 *   - Applies a conservative subset of escape replacements
 *     (`\'`, `\\`, `\n`, `\r`, `\t`).
 *
 * Design notes:
 * - This intentionally does *not* attempt to fully emulate JavaScript or
 *   HTML parsing rules; it provides a predictable, safe subset suitable
 *   for HSON tokenization.
 * - The `quoted` flag allows downstream stages to distinguish between
 *   literal text and syntactically-quoted values.
 *
 * @param s - Raw source text fragment.
 * @returns An object containing the normalized text and a `quoted` flag
 *          indicating whether the original value was quoted.
 *******/
export function lex_text_piece(s: string): { text: string; quoted: boolean } {
  const t = s.trim();
  if (!t) return { text: "", quoted: false };

  const q = t[0];
  const isQuoted = (q === '"' || q === "'") && t.length >= 2 && t[t.length - 1] === q;
  if (!isQuoted) return { text: t, quoted: false };

  const inner = t.slice(1, -1);

  // Prefer JSON semantics when double-quoted (it handles \", \\n, \uXXXX, etc.)
  if (q === '"') {
    try {
      // JSON.parse expects the full quoted string
      return { text: JSON.parse(t), quoted: true };
    } catch {
      // Fallback minimal unescape if something odd slips through
      return {
        text: inner
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t'),
        quoted: true,
      };
    }
  }

  // Single-quoted: do a reasonable subset of escapes
  return {
    text: inner
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t'),
    quoted: true,
  };
}