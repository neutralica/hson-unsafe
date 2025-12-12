// unescape_hson.ts 

/*******
 * Decode a minimal, HSON-style escape sequence set inside a string literal.
 *
 * Supported escapes:
 * - `\"` → `"`
 * - `\\` → `\`
 * - `\n` → newline
 * - `\t` → tab
 * - `\r` → carriage return
 *
 * Any escape sequence not explicitly recognized is preserved verbatim
 * (the backslash is retained), rather than throwing or silently altering
 * the input. This keeps the unescaper conservative and lossless for
 * forward-compatibility.
 *
 * Semantics:
 * - Operates on the *interior* of a quoted HSON string.
 * - Does not interpret Unicode escapes (`\uXXXX`) or octal/hex escapes.
 * - Does not validate correctness beyond the simple rules above.
 *
 * Intended use:
 * - Applied after tokenization when a value was marked as `quoted`.
 * - Serves as the single, explicit decode step on the HSON edge, keeping
 *   escaping rules predictable and localized.
 *
 * @param s - Raw string content with HSON-style backslash escapes.
 * @returns The decoded string with supported escapes resolved.
 *******/
export function unescape_hson_string(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[++i];
      if (n === '"' || n === '\\') out += n;
      else if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else { out += '\\' + n; } // preserve unknown escapes
    } else out += c;
  }
  return out;
}