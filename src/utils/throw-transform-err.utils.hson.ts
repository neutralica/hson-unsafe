// throw-transform-err.utils.hson.ts

import { _snip } from "./preview-long.utils.hson";

export function _throw_transform_err(
  message: string,
  functionName: string,
  ctx?: string  // /* changed: string only */
): never {
  /* CHANGED: clamp ctx to a small, safe snippet */
  const snip = (s: string, n = 400) => (s && s.length > n ? s.slice(0, n) + "…" : s);  // /* local, safe */
  const ctxLine = ctx ? `\n  :: ${snip(ctx)}` : "";
  const errorMessage = `[ERR: transform = ${functionName}()]:\n  -> ${message}${ctxLine}`;
  throw new Error(errorMessage);
}
