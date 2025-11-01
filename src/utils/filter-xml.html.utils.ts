

/* ──────────────────────────────────────────────────────────────
   1) Named HTML entities → numeric (XML-safe)
   Extend this table as you encounter more in the wild.
   ────────────────────────────────────────────────────────────── */
const NAMED_TO_NUMERIC: Record<string, number> = {
  nbsp: 160, copy: 169, reg: 174, trade: 8482, euro: 8364,
  pound: 163, yen: 165, hellip: 8230, mdash: 8212, ndash: 8211,
  lsquo: 8216, rsquo: 8217, ldquo: 8220, rdquo: 8221, times: 215,
  laquo: 171, raquo: 187
  // NOTE: XML’s 5 built-ins (&lt; &gt; &amp; &apos; &quot;) are already fine.
};

function replace_name_w_numeric(src: string): string {
  // Replace &name; everywhere (text & attrs) if we know the mapping
  return src.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (m, name) => {
    const cp = NAMED_TO_NUMERIC[name];
    return cp != null ? `&#${cp};` : m; // leave unknown names; they’ll fail XML (by design)
  });
}

/* ──────────────────────────────────────────────────────────────
   2) Escape raw & within quoted attribute values unless it’s an entity
   Small tokenizer: Text ↔ Tag ↔ AttrValue(" / ')
   ────────────────────────────────────────────────────────────── */
function escape_attr_amps(src: string): string {
  enum S { Text, Tag, AttrDQ, AttrSQ }
  let s = S.Text, out = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (s === S.Text) {
      if (ch === "<") { s = S.Tag; }
      out += ch;
      continue;
    }

    if (s === S.Tag) {
      if (ch === '"') { s = S.AttrDQ; out += ch; continue; }
      if (ch === "'") { s = S.AttrSQ; out += ch; continue; }
      if (ch === ">") { s = S.Text;  out += ch; continue; }
      out += ch;
      continue;
    }

    // In a quoted attribute value: only special-case '&' and the closing quote
    if (s === S.AttrDQ) {
      if (ch === '"') { s = S.Tag; out += ch; continue; }
      if (ch === "&") {
        // Look ahead to see if this is an entity (&...;)
        const rest = src.slice(i);
        const isEntity = /^&(#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]+;)/.test(rest);
        out += isEntity ? "&" : "&amp;";
        continue;
      }
      out += ch;
      continue;
    }

    if (s === S.AttrSQ) {
      if (ch === "'") { s = S.Tag; out += ch; continue; }
      if (ch === "&") {
        const rest = src.slice(i);
        const isEntity = /^&(#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]+;)/.test(rest);
        out += isEntity ? "&" : "&amp;";
        continue;
      }
      out += ch;
      continue;
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   3) Single entry: HTML-ish → XML-safe string
   Order matters: first convert known named entities, then fix raw & in attrs.
   ────────────────────────────────────────────────────────────── */
export function filter_xml(input: string): string {
  let s = input;
  s = replace_name_w_numeric(s);
  s = escape_attr_amps(s);
  return s;
}
