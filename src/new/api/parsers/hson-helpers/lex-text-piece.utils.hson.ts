// lex-text-piece.utils.hson.ts

export function lex_text_piece(s: string): { text: string; quoted: boolean } {
  const t = s.trim();
  if (!t) return { text: "", quoted: false };
  const q = t[0];
  if ((q === '"' || q === "'") && t.length >= 2 && t[t.length - 1] === q) {
    // naive unescape for now; you already do full unescape when you parse attrs/JSON
    const inner = t.slice(1, -1);
    return { text: inner, quoted: true };
  }
  return { text: t, quoted: false };
}