// preview-long.utils.hson.ts

export const _snip = (s: string, n: number = 100): string =>
  s.length > n ? s.slice(0, n) + "…" : s;