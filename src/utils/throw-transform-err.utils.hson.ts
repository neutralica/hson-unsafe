// throw-transform-err.utils.hson.ts

import { _snip } from "./snip.utils.hson";

export function _throw_transform_err(
  message: string,
  functionName: string,
  ctx?: string  // /* changed: string only */
): never {
  /* CHANGED: clamp ctx to a small, safe snippet */
  const ctxLine = ctx ? `\n  :: ${ctx}` : "";
  const errorMessage = `[ERR: transform = ${functionName}()]:\n  -> ${message}${ctxLine}`;
  throw new Error(errorMessage);
}
