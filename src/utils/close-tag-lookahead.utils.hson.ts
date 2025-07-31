// close-tag-lookahead.hson.util.ts

import { ELEM_OBJ_ARR, ELEM_TAG, ElemObjType, OBJECT_TAG } from "../types-consts/constants.hson.js";


const VERBOSE = false;
const $log = VERBOSE
    ? console.log
    : () => { };
/**
 * scans HSON lines to find the matching block closer ('>' or '/>') 
 * this determines if the block's content should be treated as element-like or object-like
 *
 * @param $blockLines - array of all input HSON lines
 * @param $openIndex - the index of the opening line
 * @param $openTag - name of the tag (mainly for logging)
 * @returns {ElemObjType}
 *          - "_elem" if the block for openedTagName closes with '/>' 
 *          - "_obj" if it closes with '>' (default, though we should not have default here ideally)
 */
export function close_tag_lookahead(
    $blockLines: string[],
    $openIndex: number,
    $openTag: string
): ElemObjType {

    let depth = 0;
    /* ^ depth of hson nesting *within the content* of openedTagName
        we are looking for a closer ('>' or '/>') for openedTagName when depth === 0 */

    /* start scanning from the line after the opening tag
        (the opening tag line itself is handled by step F) */
    for (let i = $openIndex + 1; i < $blockLines.length; i++) {
        const line = $blockLines[i];
        const trimLine = line.trim();

        if (trimLine === "" || trimLine.startsWith("//")) {
            continue;
        }

        /* --- check for structural elements on the current line --- */

        /* 1. check for closures if when depth is 0 */
        if (depth === 0) {
            if (trimLine === "/>") {
                $log(`[closeTagLookahead] <${$openTag}> (L${$openIndex + 1}) closes with '/>' at L${i + 1}; wrapper is _ELEM`);
                return ELEM_TAG;
            }
            if (trimLine === ">") {
                $log(`[closeTagLookahead] <${$openTag}> (L${$openIndex + 1}) closes with '>' at L${i + 1}; wrapper is _OBJ`);
                return OBJECT_TAG;
            }
            /* If it's not a closer for openedTagName at depth 0, it must be an opening tag
            for a child/item, or malformed HSON. */
        }

        /* 2. adjust depth based on NESTED HSON structures - count matching pairs of HSON block delimiters
            (for HSON, these are primarily tags < ... > [OR] /> and arrays « ... » */

        let scanPos = 0;
        while (scanPos < line.length) {
            const char = line[scanPos];

            if (char.match(/\s/)) { scanPos++; continue; } /* (skip whitespace) */
            if (line.startsWith("//", scanPos)) break; /* (skip comment for rest of line) */

            if (char === '"') { /* beginning of string literal text content */
                let stringEnd = scanPos + 1;
                while (stringEnd < line.length) {
                    if (line[stringEnd] === '"' && line[stringEnd - 1] !== '\\') break;
                    stringEnd++;
                }
                scanPos = (stringEnd < line.length) ? stringEnd + 1 : line.length;
                continue;
            }

            /* check for opening tags that don't self-close */
            if (char === '<' && (scanPos + 1 < line.length && line[scanPos + 1] !== '/')) {

                const { opensBlock, newPos } = analyze_open_tag(line, scanPos);
                if (opensBlock) {
                    depth++;
                    $log(`[closeTagLookahead] nested block opened. scan depth for <${$openTag}> now ${depth}. line: "${trimLine}"`);
                }
                scanPos = newPos;
                continue;
            }

            /* check for nested closers */
            if (trimLine === "/>" || trimLine === ">") {
                /* this assumes the closers for nested elements appear on their own lines */
                if (depth > 0) {
                    depth--;
                    $log(`[closeTagLookahead] Nested block closed. Scan depth for <${$openTag}> now ${depth}. Line: "${trimLine}"`);
                }
                /* if depth becomes 0 here it means the previous line was the last line of content;
                  this current line is the closer */
                scanPos = line.length; /* consume closer line */
                continue;
            }

            /* handle nested array delimiters  */
            if (char === '«' || char === '[') { depth++; }
            if (char === '»' || char === ']') { if (depth > 0) depth--; }

            scanPos++;
        }
    }

    console.error(`[closeTagLookahead] Reached EOF while scanning for closer of <${$openTag}> (opened L${$openIndex + 1}).`);
    throw new Error(`could not find closing tag for HSON string!`); /* default if no explicit closer found  */
}

/**
 * helper to analyze if a tag is a block opener or self-closes on the same line
 *  (this encapsulates parts of step F in parse_token)
 * @returns { opensBLOCK: boolean, new_position: number (position after this tag declaration) }
 */
function analyze_open_tag($line: string, $startIndex: number): { opensBlock: boolean, newPos: number } {
    /* still somewhat rough & fragile-seeming */
    let end_tag_header = $line.indexOf(">", $startIndex);
    if (end_tag_header === -1) end_tag_header = $line.length; /* tag doesn't close on this line */

    if ($line.substring($startIndex, end_tag_header + 1).includes("/>")) {
        return { opensBlock: false, newPos: end_tag_header + 1 };
    }
    /* check for <tag "primitive"> (fairly crude) */
    if ($line.substring($startIndex, end_tag_header).includes('"') && $line[end_tag_header] === '>') {
        return { opensBlock: false, newPos: end_tag_header + 1 };
    }
    /*  if it ends in '>', assume it might open a block if content follows,
        or it's part of inline content that Step F's main logic will sort out
        here, if it's just <tag>, assume it opens a block that needs a later closer */
    if ($line[end_tag_header] === '>') {
        const contentInside = $line.substring($startIndex, end_tag_header); /* "<booleanValue false" */
        const parts = contentInside.trim().split(/\s+/); /* ["<booleanValue", "false"] */

        /* if there's more than one part, it has content and is not a block opener */
        if (parts.length > 1) {
            return { opensBlock: false, newPos: end_tag_header + 1 };
        }

      /* otherwise, it's just <tag>, so it is a block opener */
        return { opensBlock: true, newPos: end_tag_header + 1 };

    }
    return { opensBlock: false, newPos: $startIndex + 1 }; /* default, advance one char */
}