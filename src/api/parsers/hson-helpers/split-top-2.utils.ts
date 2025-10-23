// split-top-2.hson.utils.ts


/**
 * split a flat array body by a separator, ignoring commas inside quotes,
 * nested arrays (both [] and «»), and inside tag headers <...>
 * note this only guards the header <...>, not inner tag content
 */
export function split_top_level($str: string, $separator: string): string[] {
  /* early out */
  if (!$str || $str.length === 0) return [];

  const results: string[] = [];
  let lastIx = 0;              /* start index of current segment */
  let ix = 0;                  /* cursor */

  /* state */
  let inString: '"' | "'" | null = null;  /* track which quote */
  let esc = false;                         /* backslash escape */
  let depthSquare = 0;                     /* [ … ] depth */
  let depthAngle = 0;                      /* « … » depth */
  let inHeader = false;                    /* inside < … > tag header */

  while (ix < $str.length) {
    const ch = $str[ix];

    /* handle escapes first */
    if (esc) { esc = false; ix++; continue; }
    if (ch === '\\') { esc = true; ix++; continue; }

    /* quoted strings */
    if (inString) {
      if (ch === inString) inString = null;
      ix++; continue;
    }
    if (ch === '"' || ch === "'") { inString = ch; ix++; continue; }

    /* tag header guard: enter on '<', exit on '>' */
    if (!inHeader && ch === '<') { inHeader = true; ix++; continue; }
    if (inHeader && ch === '>') { inHeader = false; ix++; continue; }

    /* array nesting */
    if (ch === '«') { depthAngle++; ix++; continue; }
    if (ch === '»') { depthAngle--; ix++; continue; }
    if (ch === '[') { depthSquare++; ix++; continue; }
    if (ch === ']') { depthSquare--; ix++; continue; }

    /* real split only when fully top-level */
    if (
      ch === $separator &&
      depthSquare === 0 &&
      depthAngle === 0 &&
      !inHeader
    ) {
      results.push($str.slice(lastIx, ix).trim());
      ix++;
      lastIx = ix;
      continue;
    }

    ix++;
  }

  /* tail */
  results.push($str.slice(lastIx).trim());

  /* remove accidental empties but preserve "" which arrives quoted */
  return results.filter(s => s.length > 0);
}