// OPTIONAL-END-TAG BALANCER (XML preflight)
// - Closes <li>, <dt>/<dd>, <p>, and basic table cells/rows/sections
// - Skips raw-text elements and VSN tags (<_*>)
// - Edits only the string fed to the XML parser (Nodes stay clean)

type Range = { start: number; end: number };
type ListFrame = { name: 'ul' | 'ol'; liOpen: boolean }; // CHANGED

export function optional_endtag_preflight(src: string): string {
  // 0) Fast exit
  if (!/[<]([a-zA-Z/_])/.test(src)) return src;

  // 1) Protect raw-text blocks, comments, CDATA
  const RAW = /<(script|style|textarea|noscript|xmp|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  const COMM = /<!--[\s\S]*?-->/g;
  const CDATA = /<!\[CDATA\[[\s\S]*?\]\]>/g;

  const holes: Range[] = [];
  const protect = (re: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) holes.push({ start: m.index, end: m.index + m[0].length });
  };
  protect(RAW); protect(COMM); protect(CDATA);
  holes.sort((a, b) => a.start - b.start);

  const inHole = (i: number) => {
    // binary search would be nicer; linear is fine for test inputs
    for (const h of holes) if (i >= h.start && i < h.end) return true;
    return false;
  };

  // 2) Walk tags; maintain tiny stacks for lists/dl/p/table
  type Tag = { name: string; iOpenEnd: number; iAfterOpen: number };
  const openList: ListFrame[] = [];                                     // CHANGED
  const openDL: Tag[] = [];
  let openP: Tag | null = null;
  const openTable: { tr: Tag | null; cell: Tag | null; section: 'thead' | 'tbody' | 'tfoot' | null } = { tr: null, cell: null, section: null };

  const inserts: Array<{ at: number; text: string }> = [];

  // helpers
  const isVSN = (name: string) => name.startsWith('_');
  const isVoid = (name: string) => /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(name);
  const blockStartsP = (name: string) =>
    /^(address|article|aside|blockquote|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|main|nav|ol|pre|section|table|ul)$/i.test(name);

  // regex to find tags (cheap tokenizer)
  const TAG = /<\s*(\/)?\s*([a-zA-Z_:][-a-zA-Z0-9_:.]*)\b[^>]*?(\/?)\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = TAG.exec(src))) {
    const iTag = m.index;
    if (inHole(iTag)) continue;

    const isClose = !!m[1];
    const rawName = m[2]!;
    const selfClose = !!m[3];
    const name = rawName.toLowerCase();

    if (isVSN(name)) continue;

    // --- LISTS: <ul>/<ol>/<li> ----------------------------------------------

    // CHANGED: opening a list just pushes a new frame; do not touch li state yet
    if (!isClose && (name === 'ul' || name === 'ol')) {                 // CHANGED
      openList.push({ name: name as 'ul' | 'ol', liOpen: false });      // CHANGED
      continue;
    }

    // CHANGED: when starting a new <li>, close the previous one only if liOpen at this depth
    if (!isClose && name === 'li') {                                    // CHANGED
      const last = openList[openList.length - 1];
      if (last) {
        if (last.liOpen) inserts.push({ at: iTag, text: '</li>' });     // CHANGED
        last.liOpen = true;                                             // CHANGED
      }
      continue;
    }

    // CHANGED: explicit </li> closes the liOpen bit for this depth
    if (isClose && name === 'li') {                                     // CHANGED
      const last = openList[openList.length - 1];
      if (last && last.liOpen) last.liOpen = false;                     // CHANGED
      continue;
    }

    // CHANGED: only close a dangling </li> when the list itself closes AND a <li> is actually open
    if (isClose && (name === 'ul' || name === 'ol')) {                  // CHANGED
      const last = openList[openList.length - 1];
      if (last && last.liOpen) {
        inserts.push({ at: iTag, text: '</li>' });                      // CHANGED
        last.liOpen = false;                                            // CHANGED
      }
      if (last && last.name === name) openList.pop();                   // CHANGED
      else {
        // tolerant pop if malformed nesting
        for (let i = openList.length - 2; i >= 0; i--) {
          if (openList[i].name === name) { openList.length = i; break; }
        }
        openList.pop();
      }
      continue;
    }

    // --- DL: <dl>/<dt>/<dd> ---
    if (!isClose && name === 'dl') {
      openDL.push({ name, iOpenEnd: TAG.lastIndex, iAfterOpen: TAG.lastIndex });
      continue;
    }
    if (!isClose && (name === 'dt' || name === 'dd')) {
      // close previous dt/dd
      inserts.push({ at: iTag, text: name === 'dt' ? '</dd></dt>'.replace('</dd>', '') : '</dt></dd>'.replace('</dt>', '') });
      continue;
    }
    if (isClose && name === 'dl') {
      // close any open dt/dd before </dl>
      inserts.push({ at: iTag, text: '</dd></dt>'.replace('</dd>', '').replace('</dt>', '') });
      openDL.pop();
      continue;
    }

    // --- P: close before blocks and before </p> if needed ---
    if (!isClose && name === 'p') {
      openP = { name, iOpenEnd: TAG.lastIndex, iAfterOpen: TAG.lastIndex };
      continue;
    }
    if (!isClose && openP && (blockStartsP(name) || name === 'p')) {
      inserts.push({ at: iTag, text: '</p>' });
      openP = null;
      // fall through
    }
    if (isClose && name === 'p' && openP) {
      openP = null;
      continue;
    }

    // --- TABLE family (very basic heuristics) ---
    if (!isClose && name === 'table') {
      openTable.tr = null; openTable.cell = null; openTable.section = null;
      continue;
    }
    if (!isClose && (name === 'thead' || name === 'tbody' || name === 'tfoot')) {
      if (openTable.section) {
        // CLOSE ORDER before new section starts:
        // push previous section close FIRST, then </tr>, then </td>
        inserts.push({ at: iTag, text: `</${openTable.section}>` });
        if (openTable.tr) { inserts.push({ at: iTag, text: '</tr>' }); openTable.tr = null; }
        if (openTable.cell) { inserts.push({ at: iTag, text: `</${openTable.cell.name}>` }); openTable.cell = null; }
      }
      openTable.section = name as any;
      openTable.tr = null; openTable.cell = null;
      continue;
    }
    if (!isClose && name === 'tr') {
      // ensure in a section
      if (!openTable.section) {
        inserts.push({ at: iTag, text: '<tbody>' });
        openTable.section = 'tbody';
      }
      // CLOSE ORDER at the same index (before this <tr>):
      // 1) close cell (later push → ends up closer)
      if (openTable.cell) { inserts.push({ at: iTag, text: `</${openTable.cell.name}>` }); openTable.cell = null; }
      // 2) close previous tr
      if (openTable.tr) { inserts.push({ at: iTag, text: '</tr>' }); openTable.tr = null; }

      // now open the new tr
      openTable.tr = { name, iOpenEnd: TAG.lastIndex, iAfterOpen: TAG.lastIndex };
      openTable.cell = null;
      continue;
    }
    if (!isClose && (name === 'td' || name === 'th')) {
      // ensure tr
      if (!openTable.tr) {
        inserts.push({ at: iTag, text: '<tr>' });
        openTable.tr = { name: 'tr', iOpenEnd: TAG.lastIndex, iAfterOpen: TAG.lastIndex };
      }
      // close prior cell
      if (openTable.cell) inserts.push({ at: iTag, text: `</${openTable.cell.name}>` });
      openTable.cell = { name, iOpenEnd: TAG.lastIndex, iAfterOpen: TAG.lastIndex };
      continue;
    }
    if (isClose && (name === 'td' || name === 'th')) {
      openTable.cell = null; continue;
    }
    if (isClose && name === 'tr') {
      if (openTable.cell) { inserts.push({ at: iTag, text: `</${openTable.cell.name}>` }); openTable.cell = null; }
      openTable.tr = null; continue;
    }
    if (isClose && name === 'table') {
      // push in this order so final text reads </td></tr></tbody>...
      if (openTable.section) { inserts.push({ at: iTag, text: `</${openTable.section}>` }); openTable.section = null; }
      if (openTable.tr) { inserts.push({ at: iTag, text: '</tr>' }); openTable.tr = null; }
      if (openTable.cell) { inserts.push({ at: iTag, text: `</${openTable.cell.name}>` }); openTable.cell = null; }
      continue;
    }


    // --- Void/self-closing: ignore ---
    if (!isClose && (selfClose || isVoid(name))) continue;
  }

  // 3) Apply inserts (right-to-left so offsets stay valid)
  if (!inserts.length) return src;
  inserts.sort((a, b) => b.at - a.at);
  let out = src;
  for (const ins of inserts) {

    if (inHole(ins.at)) continue;
    out = out.slice(0, ins.at) + ins.text + out.slice(ins.at);
  }

  console.log('out final')
  console.log(out)


  return out;
}
