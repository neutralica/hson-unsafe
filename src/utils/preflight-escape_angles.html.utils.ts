// Escape literal '<' and '>' inside quoted attribute values.
// Leaves text nodes and already-escaped entities alone.
export function escape_attr_angles(src: string): string {
  let out = '';
  let inTag = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;

    if (!inTag) {
      if (ch === '<') { inTag = true; out += ch; continue; }
      out += ch; continue;
    }

    // inTag === true
    if (quote) {
      if (ch === quote) { quote = null; out += ch; continue; }
      if (ch === '<') { out += '&lt;'; continue; }
      if (ch === '>') { out += '&gt;'; continue; }
      out += ch; continue;
    } else {
      if (ch === '"' || ch === "'") { quote = ch as '"' | "'"; out += ch; continue; }
      if (ch === '>') { inTag = false; out += ch; continue; }
      out += ch; continue;
    }
  }
  return out;
}