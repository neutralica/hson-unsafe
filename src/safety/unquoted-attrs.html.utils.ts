// Quote unquoted attribute values: foo=bar  ->  foo="bar"
// Does not touch values already quoted with " or '
// Safe for punctuation allowed by HTML in unquoted attrs.
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