// preview-long.utils.hson.ts

export const snip_long_string = (s: string, n: number = 100): string =>
  s.length > n ? s.slice(0, n) + "…" : s;