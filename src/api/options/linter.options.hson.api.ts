// linter.options.hson.api.ts

import { HsonNode, is_Node_NEW } from "../..";
import { escape_attrs } from "../../utils/escape_attrs.utils";
import { serialize_style } from "../../utils/serialize-css.utils";



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

    const attrs = Object.entries(node._attrs ?? {})
        .flatMap(([k, v]) => {
            // skip nullish/false
            if (v == null || v === false) return [];

            // style object -> CSS string
            if (k === "style" && typeof v === "object" && !Array.isArray(v)) {
                const css = serialize_style(v as Record<string, string>);
                return css ? [`style="${escape_attrs(css)}"`] : [];
            }

            // boolean true -> flag (no ="")
            if (v === true) return [k];

            // everything else -> key="value"
            return [`${k}="${escape_attrs(String(v))}"`];
        });
    const oneLine = `<${node._tag}` +
        (attrs.length ? " " + attrs.join(" ") : "") +
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
        if (attrs.length) {
            parts.push(attrs.join(" "));
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
    const inlineCandidate = `<${node._tag}${attrs.length ? " " + attrs.join(" ") : ""}>${text}</${node._tag}>`;

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
    if ((attrs.join(" ")).length > maxAttrsFlagsLen) {
        if (attrs.length) {
            /* split attrs */
            attrs.forEach(a => {
                if (a.length > maxSingleAttrLen)
                    wrap(a, indent).forEach(l => lines.push(indent + l));
                else
                    lines.push(indent + a);
            });
        }
    } else if (attrs.length) {
        lines.push(indent + attrs.join(" "));
    }

    /* children rule */
    node._content.forEach(child => {
        if (typeof child === "string") {
            wrap(child, indent).forEach(l => lines.push(l));
        } else if (is_Node_NEW(child)) {
            /* likely an HSON_Node (?) */
            const childLines = linter(child as HsonNode, opts).split("\n");
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
