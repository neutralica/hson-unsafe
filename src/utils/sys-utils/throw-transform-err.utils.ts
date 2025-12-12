// throw-transform-err.utils.ts

/**
 * Throw a standardized transform-stage error with contextual formatting.
 *
 * This helper centralizes error construction for HSON transform and parsing
 * phases, ensuring consistent, readable diagnostics across the codebase.
 *
 * Behavior:
 * - Prefixes the message with the transform function name for fast attribution.
 * - Optionally appends a short context snippet (e.g. source fragment or value).
 * - Always throws synchronously and never returns.
 *
 * Intended use:
 * - Parser, tokenizer, and transform utilities where failures are structural
 *   and should immediately abort processing.
 * - Error messages meant for developers rather than end users.
 *
 * @param message - Human-readable description of what went wrong.
 * @param functionName - Logical name of the transform or helper throwing.
 * @param ctx - Optional contextual string (kept intentionally short).
 * @throws {Error} Always throws with a formatted transform error message.
 */
export function _throw_transform_err(
  message: string,
  functionName: string,
  ctx?: string  
): never {
  /*  clamp ctx to a small, safe snippet */
  const ctxLine = ctx ? `\n  :: ${ctx}` : "";
  const errorMessage = `[ERR: transform = ${functionName}()]:\n  -> ${message}${ctxLine}`;
  throw new Error(errorMessage);
}
