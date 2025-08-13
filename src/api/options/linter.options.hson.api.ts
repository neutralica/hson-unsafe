// linter.options.hson.api.ts

import { HsonNode } from "../../types-consts/node.types.hson";



export function linter(
    node: HsonNode,
    opts: {
        maxNodeLen?: number;
        maxAttrsFlagsLen?: number;
        maxSingleAttrLen?: number;
        wrapWidth?: number;
        indent?: string;
    } = {}
) {
    const {
        maxNodeLen = 100,
        maxAttrsFlagsLen = 60,
        maxSingleAttrLen = 50,
        wrapWidth = 80,
        indent = "  ",
    } = opts;

    /* wrap long text at wrapWidth, indenting continuations */
    function wrap(text: string, baseIndent = "") {
        const words = text.split(/\s+/);
        let line = baseIndent, out = [];
        for (let w of words) {
            if ((line + " " + w).length > wrapWidth) {
                out.push(line);
                line = baseIndent + w;
            } else {
                line += (line.trim() ? " " : "") + w;
            }
        }
        out.push(line);
        return out;
    }

    /* serialize attrs and flags */
    const attrs = Object.entries(node._meta.attrs)
        .map(([k, v]) => `${k}="${v}"`);
    const flags = node._meta.flags.map(f => f.toString());
    const oneLine = `<${node._tag}` +
        (attrs.length ? " " + attrs.join(" ") : "") +
        (flags.length ? " " + flags.join(" ") : "") +
        // this was > or /> but I think that's a holdover. 
        `${node._content.length ? ">" : " >"}`;

    /* top-level rule */
    if (oneLine.length < maxNodeLen && !node._content.length) {
        return oneLine; /* self-closing or empty */
    }
    if (!node._content.length && oneLine.length < maxNodeLen) {
        return oneLine;
    }

    if (!node._content.length) {
        const parts = [`<${node._tag}`];
        if (attrs.length || flags.length) {
            parts.push(attrs.concat(flags).join(" "));
        }
        parts.push(">");
        return parts.join(" ");
    }

    if (oneLine.length < maxNodeLen && node._content.every(c => typeof c === "string")) {
        /* small text node */
        return oneLine + node._content.join("") + `</${node._tag}>`;
    }
    const isSingleTextChild =
        node._content.length === 1 &&
        typeof node._content[0] === "string";

    const text = isSingleTextChild ? node._content[0] : null;
    const inlineCandidate = `<${node._tag}${attrs.length ? " " + attrs.join(" ") : ""}${flags.length ? " " + flags.join(" ") : ""}>${text}</${node._tag}>`;

    if (isSingleTextChild && inlineCandidate.length <= maxNodeLen) {
        return inlineCandidate;
    }

    // const allInline =
    //     node.content.length === 1 &&
    //     typeof node.content[0] === "string" &&
    //     oneLine.length + node.content[0].length + node.tag.length + 3 < maxNodeLen;

    // if (allInline) {
    //     return `<${node.tag}${attrs.length ? " " + attrs.join(" ") : ""} "${node.content[0]}">`;
    // }

    let lines = [];
    lines.push(`<${node._tag}>`);

    /* attrs & flags rule */
    if ((attrs.join(" ") + flags.join(" ")).length > maxAttrsFlagsLen) {
        if (attrs.length) {
            /* split attrs */
            attrs.forEach(a => {
                if (a.length > maxSingleAttrLen)
                    wrap(a, indent).forEach(l => lines.push(indent + l));
                else
                    lines.push(indent + a);
            });
        }
        if (flags.length) {
            flags.forEach(f => lines.push(indent + f));
        }
    } else if (attrs.length || flags.length) {
        lines.push(indent + attrs.concat(flags).join(" "));
    }

    /* children rule */
    node._content.forEach(child => {
        if (typeof child === "string") {
            wrap(child, indent).forEach(l => lines.push(l));
        } else if (typeof child === "object" && child !== null && "_tag" in child && Array.isArray(child._content)) {
            /* likely an HSON_Node (?) */
            const childLines = linter(child, opts).split("\n");
            childLines.forEach(line => lines.push(indent + line));

        } else {
           /* BasicValue — skip or log */
            lines.push(indent + child);
            return;
        }
    });

    lines.push(`</${node._tag}>`);
    return lines.join("\n");
}
