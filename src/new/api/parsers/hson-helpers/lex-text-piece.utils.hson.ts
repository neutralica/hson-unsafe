// lex-text-piece.utils.hson.ts
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