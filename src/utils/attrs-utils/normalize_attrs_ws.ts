// normalize_attrs_ws.utils.ts

export function normalize_attr_ws(s: string): string {
  // don’t use on 'style'
  return s
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}
