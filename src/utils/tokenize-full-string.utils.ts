// --- quoted-span reader ------------------------------------------------------

import { _throw_transform_err } from "./throw-transform-err.utils";

type QuoteDelim = '"' | "'" | '`';

export function is_quote(ch: string): ch is QuoteDelim {
  return ch === '"' || ch === "'" || ch === '`';
}

/**
 * Read a quoted literal starting at (lineIdx, colIdx) where the current
 * character is one of: " ' `
 *
 * - Consumes across lines until it finds the first *unescaped* matching closer.
 * - Preserves everything verbatim inside (including //, [JAVASCRIPT COMMENTS], #, <, >, etc).
 * - Honors backslash escapes for the current delimiter and backslash itself.
 * - Does NOT unescape; returns the inner content exactly as written.
 *
 * Returns the inner text and the updated cursor positioned *after* the closer.
 *
 * Throws on EOF without a matching closer.
 */
export function scan_quoted_block(
  lines: string[],
  lineIdx: number,
  colIdx: number // cursor at the opening quote
): { raw: string; endLine: number; endCol: number; delim: QuoteDelim } {
  const line = lines[lineIdx] ?? '';
  const opener = line[colIdx];
  if (!is_quote(opener)) {
    _throw_transform_err(
      `readQuotedSpan: expected quote at ${lineIdx + 1}:${colIdx + 1}`,
      'tokenize_hson.readQuotedSpan'
    );
  }

  const delim: QuoteDelim = opener as QuoteDelim;
  let i = lineIdx;
  let j = colIdx + 1; // start after the opener
  let raw = '';
  let escaped = false;

  while (i < lines.length) {
    const cur = lines[i];

    while (j < cur.length) {
      const ch = cur[j];

      if (escaped) { raw += '\\' + ch; escaped = false; j++; continue; }
      if (ch === '\\') { escaped = true; j++; continue; }

      // Found unescaped closer → finish
      if (ch === delim) {
        return { raw, endLine: i, endCol: j + 1, delim };
      }

      // Any other char is literal (including quotes of *other* kinds and comment tokens)
      raw += ch;
      j++;
    }

    // End of line without closing delimiter → preserve newline and continue
    raw += '\n';
    i++;
    j = 0;
  }

  // If we got here, we ran out of lines without a closer
  _throw_transform_err('unterminated quoted string', 'tokenize_hson.readQuotedSpan');
}
