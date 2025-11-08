// HTML allows: data-flag=  → empty string. XML requires quotes.
// This quotes ANY unquoted attr value, including empty-before-terminator.
export function quote_unquoted_attrs(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { out += src.slice(i); break; }
    const gt = src.indexOf(">", lt + 1);
    if (gt < 0) { out += src.slice(i); break; }

    out += src.slice(i, lt);
    const tag = src.slice(lt, gt + 1);

    // Skip comments/doctype/PI
    if (/^<\/|^<!|^<\?/.test(tag.slice(1))) { out += tag; i = gt + 1; continue; }

    // name[=value]? — preserve quoted as-is; quote unquoted
    const rewritten = tag.replace(
      /(\s+[^\s"'=\/><]+)\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^ \t\r\n"'=<>`]+)?)(?=[\s\/>])/g,
      (_m, nameWithSpace, dq, sq, unq) => {
        if (dq !== undefined) return `${nameWithSpace}="${dq}"`; // keep double-quoted
        if (sq !== undefined) return `${nameWithSpace}='${sq}'`; // keep single-quoted
        // UNQUOTED (maybe empty): emit as double-quoted, escape embedded "
        const val = (unq ?? "").replace(/"/g, "&quot;");
        return `${nameWithSpace}="${val}"`;
      }
    );

    out += rewritten;
    i = gt + 1;
  }
  return out;
}