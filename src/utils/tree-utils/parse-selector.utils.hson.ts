// parse-selector.utils.hson.ts

import { HsonQuery } from "../../api/tree/hson-tree-class.tree.hson";

/**
 * parses a simple CSS selector string into an HsonQuery object
 *   currently supports: tag, #id, .class, [attribute], and [attribute="value"]
 */
export function parseSelector(selector: string): HsonQuery {
    const query: HsonQuery = {attrs: {}, flags: []};

    /* regular expression matches the parts of a selector */
    const tagRegex = /^[a-zA-Z0-9]+/;
    const idRegex = /#([a-zA-Z0-9_-]+)/g;
    const classRegex = /\.([a-zA-Z0-9_-]+)/g;
    const attrRegex = /\[([a-zA-Z0-9_-]+)(?:="([^"]+)")?\]/g;

    /* extract tag name */
    const tagMatch = selector.match(tagRegex);
    if (tagMatch) {
        query.tag = tagMatch[0];
    }

    /* extract id */
    let match;
    while ((match = idRegex.exec(selector)) !== null) {
        query.attrs!.id = match[1];
    }

    /* extract classList */
    while ((match = classRegex.exec(selector)) !== null) {
        query.attrs!.class = ((query.attrs!.class || '') + ' ' + match[1]).trim();
    }

    /* extract attrs & flags */
    while ((match = attrRegex.exec(selector)) !== null) {
        const [, key, value] = match;
        if (value !== undefined && value !== key) {
            query.attrs![key] = value;/* [attr="value"] */
        } else {
            query.flags?.push(key); /* [flag="flag"] */
        }
    }

    return query;
}