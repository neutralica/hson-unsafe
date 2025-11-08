// Escapes `<` and `>` ONLY while inside "..." or '...' attribute values.
// Leaves everything else untouched. No regex splitting; single pass.
export function esc_attrs_quoted_angles(src: string): string {
  enum S { Text, Tag, AttrName, EqWait, QuotedD, QuotedS }
  let s = S.Text, q = 0, out = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i);
    const c = src[i];

    switch (s) {
      case S.Text:
        if (c === "<") { s = S.Tag; }
        out += c;
        break;

      case S.Tag:
        if (c === ">") { s = S.Text; out += c; break; }
        if (c === "'" || c === '"') { // attr value starting w/o '=' — rare, still treat as quoted
          s = (c === '"') ? S.QuotedD : S.QuotedS; out += c; break;
        }
        if (/\s/.test(c)) { out += c; break; }
        if (c === "=") { s = S.EqWait; out += c; break; }
        // heuristic: after a name and '=', we’ll hit EqWait; until then we’re in attr name / tag name
        out += c;
        break;

      case S.EqWait: {
        if (c === '"') { s = S.QuotedD; q = 0; out += c; break; }
        if (c === "'") { s = S.QuotedS; q = 0; out += c; break; }
        // unquoted value begins; revert to Tag state, but NOT quoted
        s = S.Tag; out += c; break;
      }

      case S.QuotedD:
        if (c === '"') { s = S.Tag; out += c; break; }
        if (c === "<") { out += "&lt;"; break; }
        if (c === ">") { out += "&gt;"; break; }
        out += c; break;

      case S.QuotedS:
        if (c === "'") { s = S.Tag; out += c; break; }
        if (c === "<") { out += "&lt;"; break; }
        if (c === ">") { out += "&gt;"; break; }
        out += c; break;
    }
  }
  return out;
}
