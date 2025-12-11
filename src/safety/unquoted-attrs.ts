// unquoted-attrs.ts

/***************************************************************
 * quote_unquoted_attrs
 *
 * Normalize HTML attribute syntax by wrapping unquoted values
 * in double quotes, without touching already-quoted values.
 *
 * Transform:
 *   - `<a href=/foo bar=baz>` → `<a href="/foo" bar="baz">`
 *   - `<input disabled>`      → unchanged (flag attribute)
 *   - `<div data-x="y">`      → unchanged (already quoted)
 *
 * Parsing rules:
 *   - Operates per start tag via:
 *       /<([a-zA-Z][^\s>/]*)([^>]*?)>/g
 *     capturing:
 *       1) tag name
 *       2) raw attribute text
 *
 *   - Inside the attribute slice, matches:
 *       /(\s+)([^\s"'=\/><]+)\s*=\s*([^\s"'<>`]+)/g
 *     which treats as candidates:
 *       - any name without whitespace/"'/=/</>/,
 *       - followed by `=`,
 *       - whose value does *not* start with a quote,
 *       - and continues until whitespace, `>`, or backtick.
 *
 * Safety / limitations:
 *   - Does not attempt to fully re-parse HTML; works as a
 *     heuristic filter on “normal” attribute syntax.
 *   - Will not fix pathological markup with embedded `>`
 *     or whitespace in ways that violate HTML’s grammar.
 *   - Leaves existing quoted values exactly as-is, including
 *     internal spaces, entities, etc.
 *
 * Typical usage:
 *   - As a normalization step before further string-based
 *     HTML tools that assume `name="value"` form.
 *   - Not required when using a DOM-based sanitizer/parser,
 *     but useful on raw serializer output or legacy markup.
 *
 * @param src  HTML or tag-fragment string to rewrite.
 * @returns    A string where unquoted attribute values are
 *             converted to `name="value"` form.
 ***************************************************************/
export function quote_unquoted_attrs(src: string): string {
    return src.replace(
        /<([a-zA-Z][^\s>/]*)([^>]*?)>/g,
        (_m: string, tag: string, attrs: string) => {
            const rewritten = attrs.replace(
                // name = value   where value does NOT start with a quote
                // VALUE FIX: allow '=' inside value; stop only at whitespace or tag end
                /(\s+)([^\s"'=\/><]+)\s*=\s*([^\s"'<>`]+)/g,
                (_m2: string, ws: string, name: string, val: string) => {
                    return `${ws}${name}="${val}"`;
                }
            );
            return `<${tag}${rewritten}>`;
        }
    );
}