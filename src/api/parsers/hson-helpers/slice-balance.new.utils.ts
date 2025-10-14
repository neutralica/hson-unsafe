// slice-balance.new.utils.ts

import { _throw_transform_err } from "../../../utils/throw-transform-err.utils";

/**
 * slice_balanced_arr:
 *  - works on a single string (can pass a joined multi-line slice)
 *  - tracks quotes and backslash escapes
 *  - tracks nested opener/closer
 *  - returns { body, endIndex } where endIndex is the index of the closer char
 */
export function slice_balanced_arr(
  $s: string,
  $startIndex: number,      /* index of the first char *after* the opener */
  $opener: string,
  $closer: string
): { body: string; endIndex: number } {
  let depth = 1;
  let ix = $startIndex;
  let inQuote = false;
  let escaped = false;

  while (ix < $s.length) {
    const ch = $s[ix];

    if (inQuote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inQuote = false;
      }
      ix++;
      continue;
    }

    if (ch === '"') {
      inQuote = true;
      ix++;
      continue;
    }

    /* multi-char openers/closers are supported */
    if ($opener.length === 1 && ch === $opener) {
      depth++; ix++; continue;
    }
    if ($closer.length === 1 && ch === $closer) {
      depth--; 
      if (depth === 0) {
        const body = $s.slice($startIndex, ix);
        return { body, endIndex: ix };
      }
      ix++; 
      continue;
    }

    /* fallback for multi-char sequences */
    if ($opener.length > 1 && $s.startsWith($opener, ix)) { depth++; ix += $opener.length; continue; }
    if ($closer.length > 1 && $s.startsWith($closer, ix)) {
      depth--;
      if (depth === 0) {
        const end = ix;
        const body = $s.slice($startIndex, end);
        return { body, endIndex: end };
      }
      ix += $closer.length;
      continue;
    }

    ix++;
  }

  _throw_transform_err(` unmatched ${$opener}${$closer} starting at ${$startIndex}`, '[scan_balanced_flat]', $s);
}