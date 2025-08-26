/* unescape_hson.utils.hson.ts */
/* simple HSON-style unescaper: \" \\ \n \t \r ; leave unknown escapes as-is */
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