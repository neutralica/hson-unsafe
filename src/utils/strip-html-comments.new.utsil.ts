// strip-html-comments.util.ts

/**
 * Removes HTML/ESI comments from a string BEFORE XML parsing.
 * - Strips all <!-- ... --> blocks (non-greedy, multiline)
 * - Also removes any unterminated <!-- ... at EOF (for bad markup in the wild)
 * - Does NOT touch anything else; safe to run before your other preflight steps
 */
export function strip_html_comments(input: string): string {
  if (!input || input.indexOf('<!--') === -1) return input;

  // 1) Remove all properly closed comments
  let out = input.replace(/<!--[\s\S]*?-->/g, '');

  // 2) Remove any leftover unterminated comment to end-of-input
  out = out.replace(/<!--[\s\S]*$/g, '');

  return out;
}
