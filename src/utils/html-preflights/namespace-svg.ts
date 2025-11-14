export function namespace_svg(src: string): string {
    if (!/<svg\b/i.test(src)) return src;

    const hasSvgNS = /<svg\b[^>]*\bxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(src);
    const usesXlink = /\bxlink:/i.test(src);
    const hasXlink = /<svg\b[^>]*\bxmlns:xlink\s*=/i.test(src);

    return src.replace(/<svg\b([^>]*)>/i, (_m, attrs) => {
        let add = "";
        if (!hasSvgNS) add += ` xmlns="http://www.w3.org/2000/svg"`;
        if (usesXlink && !hasXlink) add += ` xmlns:xlink="http://www.w3.org/1999/xlink"`;
        return `<svg${attrs}${add}>`;
    });
}
