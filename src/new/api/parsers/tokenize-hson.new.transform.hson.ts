// tokenize-hson.old.hson.ts

import { Primitive } from "../../../core/types-consts/core.types.hson";
import { is_not_string, is_Primitive } from "../../../core/utils/guards.core.utils.hson";
import { OBJECT_TAG, ARRAY_TAG, ELEM_TAG, ROOT_TAG } from "../../../types-consts/constants.hson";
import { close_tag_lookahead } from "../../../utils/close-tag-lookahead.utils.hson";
import { make_string } from "../../../utils/make-string.utils.hson";
import { is_Node } from "../../../utils/node-guards.utils.hson";
import { parse_css_attrs } from "../../../utils/parse-css.utils.hson";
import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson";
import { ARR_SYMBOL, CLOSE_KIND, NEW_ARR_CLOSE_TOKEN, NEW_ARR_OPEN_TOKEN, NEW_END_TOKEN, NEW_OPEN_TOKEN, NEW_TEXT_TOKEN, TOKEN_KIND } from "../../types-consts/constants.new.hson";
import { Position, RawAttr, Tokens_NEW } from "../../types-consts/tokens.new.types.hson";
import { split_top_level_NEW } from "./tokenizer-helpers/split-top-2.utils.hson";
import { slice_balanced_arr } from "./tokenizer-helpers/balancers.new.utils.hson";


/* position tracker */
const _pos = (lineno: number, colno: number, posix: number): Position => ({ line: lineno, col: colno, index: posix });

/* structure for items stored on the context stack */
type ContextStackItem =
    | { type: 'TAG'; tag: string }
    | { type: 'CLUSTER'; close?: 'obj' | 'elem' }   /* replaces the old _obj/_elem sentinels */
    | { type: 'IMPLICIT_OBJECT' };

const LONE_OPEN_ANGLE_REGEX = /^\s*<(\s*(\/\/.*)?)?$/;
/* Regex for an implicit object starting on a line, e.g., "< <prop val>>" or "< <" */
const IMPLICIT_OBJECT_START_REGEX = /^\s*<\s*<(\s|$)/; /* ensures second '<' is followed by space or EOL */


const _VERBOSE = false;
const _log = _VERBOSE
    ? console.log
    : () => { };
let tokenFirst: boolean = true;

export function tokenize_hson_NEW($hson: string, $depth = 0): Tokens_NEW[] {

    const maxDepth = 50;
    _log(`[token_from_hson called with depth=${$depth}]`);
    if (tokenFirst) {
        if (_VERBOSE) {
            console.groupCollapsed('---> tokenizing hson')
            console.log('input hson')
            console.log($hson);
            console.groupEnd();
            tokenFirst = false;
        }
    }
    if ($depth >= maxDepth) {
        _throw_transform_err(`stopping potentially infinite loop (depth >= ${maxDepth})`, 'tokenize_hson', $hson);
    }

    const finalTokens: Tokens_NEW[] = [];
    const contextStack: ContextStackItem[] = [];
    const splitLines = $hson.split(/\r\n|\r|\n/);
    let ix = 0;

    _log(`[token_from_hson depth=${$depth}]; total lines: ${splitLines.length}`);

    function _bump_line($line: string) { _offset += $line.length + 1; ix++; }

    /* advance by N following lines starting at current ix */
    function _bump_array($count: number) {
        for (let n = 0; n < $count; n++) {
            const L = splitLines[ix + n] ?? '';
            _offset += L.length + 1;
        }
        ix += $count;
    }

    /* read attrs in a tag header slice (within trimLine) into RawAttr[] */
    function _read_tag_attrs(
        $trimLine: string,
        $startIx: number,                /* first char after tag name */
        $endIx: number,                  /* index of '>' or '/' that starts '/>' */
        $lineNo: number,
        $leadCol: number                 /* first non-space col in currentLine (1-based) */
    ): RawAttr[] {
        const out: RawAttr[] = [];
        let ix = $startIx;
        const end = $endIx;

        let inQuote: '"' | "'" | null = null;
        let escaped = false;

        /* helper for positions within trimLine → absolute */
        const _col = (relIx: number) => $leadCol + relIx;                 /* 1-based col */
        const _pos = (relIx: number): Position => {
            const col = _col(relIx);
            return { line: $lineNo, col, index: _offset + col - 1 };
        };

        /* skip spaces */
        const _skip_ws = () => { while (ix < end && /\s/.test($trimLine[ix])) ix++; };

        while (ix < end) {
            _skip_ws();
            if (ix >= end) break;

            /* name */
            const nameStartIx = ix;
            if (!/[A-Za-z_:]/.test($trimLine[ix])) {
                /* not starting an attr name → bail */
                break;
            }
            ix++;
            while (ix < end && /[\w:.\-]/.test($trimLine[ix])) ix++;
            const name = $trimLine.slice(nameStartIx, ix);
            const startPos = _pos(nameStartIx);

            _skip_ws();

            /* value? '=' then quoted or bare token, else it's a flag */
            if (ix < end && $trimLine[ix] === '=') {
                ix++; _skip_ws();
                let valStart = ix;

                /* quoted */
                if (ix < end && ($trimLine[ix] === '"' || $trimLine[ix] === "'")) {
                    inQuote = $trimLine[ix] as '"' | "'";
                    ix++; valStart = ix;
                    while (ix < end) {
                        const ch = $trimLine[ix];
                        if (escaped) { escaped = false; ix++; continue; }
                        if (ch === '\\') { escaped = true; ix++; continue; }
                        if (ch === inQuote) { break; }
                        ix++;
                    }
                    const text = $trimLine.slice(valStart, ix);
                    if (ix < end && $trimLine[ix] === inQuote) ix++; /* consume quote */
                    const endPos = _pos(ix);
                    out.push({ name, value: { text, quoted: true }, start: startPos, end: endPos });
                }
                /* unquoted token (stops at ws or end) */
                else {
                    while (ix < end && !/\s/.test($trimLine[ix])) ix++;
                    const text = $trimLine.slice(valStart, ix);
                    const endPos = _pos(ix);
                    out.push({ name, value: { text, quoted: false }, start: startPos, end: endPos });
                }
            } else {
                /* flag */
                const endPos = _pos(ix);
                out.push({ name, start: startPos, end: endPos });
            }
        }

        return out;
    }

    let _offset = 0;
    while (ix < splitLines.length) {
        const currentIx = ix;
        const currentLine = splitLines[ix];
        const trimLine = currentLine.trim();

        _log(`[token_from_hson depth=${$depth} L=${currentIx + 1}/${splitLines.length}]: processing: "${trimLine}" (Original: "${currentLine}")`);

        /* Step A */
        /* skip empty/comment lines */
        if (!trimLine || trimLine.startsWith('//')) {
            _log(`[token_from_hson depth=${$depth} L=${currentIx + 1}] skipping comment/empty`);
            _bump_line(currentLine);
            continue;
        }

        /* Step B */
        /* check for '<' implicit object trigger */
        if (LONE_OPEN_ANGLE_REGEX.test(currentLine)) {
            _log(`[tokenize_hson depth=${$depth} L=${currentIx + 1}] lone '<' detected`);
            contextStack.push({ type: 'IMPLICIT_OBJECT' });      /* keep marker if you need it */
            contextStack.push({ type: 'CLUSTER', close: 'obj' });/* structural intent */
            _bump_line(currentLine);
            continue;
        }

        /* Step C */
        /* handle empty arrays «» */
        if (/^«\s*»\s*$/.test(trimLine) || /^\[\s*\]\s*$/.test(trimLine)) {
            const variant = trimLine.startsWith('«') ? ARR_SYMBOL.guillemet : ARR_SYMBOL.bracket;
            const col = currentLine.search(/\S|$/) + 1; /* first non-space, 1-based */
            const p = _pos(currentIx + 1, col, _offset + col - 1);

            _log(`[quick]: empty array detected (${variant})`);
            finalTokens.push(NEW_ARR_OPEN_TOKEN(variant, p));
            finalTokens.push(NEW_ARR_CLOSE_TOKEN(variant, p));

            _bump_line(currentLine);
            continue;
        }

        /* Step D */
        /* handle _array delimiters */
        if (trimLine.startsWith('«') || trimLine.startsWith('[')) {
            const opener = trimLine.startsWith('«') ? '«' : '[';
            const closer = opener === '«' ? '»' : ']';
            const variant = opener === '«' ? ARR_SYMBOL.guillemet : ARR_SYMBOL.bracket;

            _log(`[tokenize_hson]: processing array (${variant})`);

            /* build a joined view from the current line onward */
            const joinedFromHere = splitLines.slice(ix).join('\n');
            const colInLine = currentLine.indexOf(opener) + 1;     /* 1-based col */
            const startInJoined = currentLine.indexOf(opener) + 1; /* index after opener */

            /* slice the balanced body (quote-aware, nested-pair aware) */
            const { body, endIndex } = slice_balanced_arr(joinedFromHere, startInJoined, opener, closer);

            /* compute how many lines were consumed up to the closer */
            const consumedText = joinedFromHere.slice(0, endIndex + 1); /* includes closer */
            const linesConsumed = consumedText.split('\n').length - 1;

            const pOpen = _pos(currentIx + 1, colInLine, _offset + colInLine - 1);
            const pClose = _pos(currentIx + 1 + linesConsumed, 1, _offset + consumedText.length);

            finalTokens.push(NEW_ARR_OPEN_TOKEN(variant, pOpen));

            /* split the array body by top-level commas (quote/array/header aware) */
            const items = split_top_level_NEW(body, ',');

            for (const itemRaw of items) {
                const item = itemRaw.trim();
                if (!item) continue;

                if (item.startsWith('<') || item.startsWith('«') || item.startsWith('[')) {
                    finalTokens.push(...tokenize_hson_NEW(item, $depth + 1));
                } else {
                    /* CHANGED: no coerce here; parser will decide _str vs _val */
                    finalTokens.push(NEW_TEXT_TOKEN(item, /* quoted */ undefined, pOpen));
                }
            }

            finalTokens.push(NEW_ARR_CLOSE_TOKEN(variant, pClose));

            /* advance main loop to the line containing the closer */
            _bump_array(linesConsumed + 1);
            continue;
        }

        /* step E */
        const closerMatch = currentLine.match(/^\s*(\/?>)\s*(?:\/\/.*)?$/);
        if (closerMatch) {
            const closerLex = closerMatch[1];
            const close = closerLex === '/>' ? CLOSE_KIND.elem : CLOSE_KIND.obj;
            const col = currentLine.indexOf(closerLex) + 1;
            const pos = _pos(currentIx + 1, col, _offset + col - 1);

            const top = contextStack[contextStack.length - 1];
            if (!top || top.type !== 'CLUSTER') {
                _throw_transform_err(`[step e] closer '${closerLex}' but stack top is ${JSON.stringify(top)}`, 'tokenize-hson', currentLine);
            }
            if (top.close && top.close !== close) {
                _throw_transform_err(`[step e] mismatched closer '${closerLex}' for cluster '${top.close}'`, 'tokenize-hson', currentLine);
            }
            /* set if pending */
            top.close = close;

            /* pop + emit */
            contextStack.pop();
            finalTokens.push(NEW_END_TOKEN(close, pos));

            /* clean up implicit marker if present */
            const maybeImplicit = contextStack[contextStack.length - 1];
            if (maybeImplicit && maybeImplicit.type === 'IMPLICIT_OBJECT' && close === CLOSE_KIND.obj) {
                contextStack.pop();
            }

            _bump_line(currentLine);
            continue;
        }

        /* step F: open tags */
        if (trimLine.startsWith('<')) {

            /* f.1 implicit object opener "< <...": accept preamble, no tokens, structure only */
            if (IMPLICIT_OBJECT_START_REGEX.test(trimLine)) {
                _log(`[step f depth=${$depth} L=${currentIx + 1}] implicit object opener`);
                contextStack.push({ type: 'IMPLICIT_OBJECT' });
                contextStack.push({ type: 'CLUSTER' }); /* pending close kind */

                const secondIx = trimLine.indexOf('<', trimLine.indexOf('<') + 1);
                const inner = secondIx >= 0 ? trimLine.substring(secondIx).trim() : '';
                if (inner) {
                    const innerTokens = tokenize_hson_NEW(inner, $depth + 1);
                    finalTokens.push(...innerTokens);
                }
                _bump_line(currentLine);
                continue;
            }

            /* f.2 read tag header minimally: name + find header end (no attrs yet) */
            let ixHeader = 1;                               /* skip initial '<' */
            const lineLength = trimLine.length;
            while (ixHeader < lineLength && /\s/.test(trimLine[ixHeader])) ixHeader++;

            const nameStart = ixHeader;
            while (ixHeader < lineLength && /[A-Za-z0-9:._-]/.test(trimLine[ixHeader])) ixHeader++;
            const tag = trimLine.slice(nameStart, ixHeader);

            if (!tag) {
                _throw_transform_err(`[step f depth=${$depth} L=${currentIx + 1}] malformed tag in "${trimLine}"`, 'tokenize-hson', currentLine);
            }

            /* f.2.1 scan to header end outside quotes, capturing inline tail */
            let inQ: '"' | "'" | null = null;
            let esc = false;
            let closerLex: '>' | '/>' | null = null;
            let headerEndCol = ixHeader + 1;         /* 1-based col guess; refine when we hit closer */
            let scanIx = ixHeader;

            while (scanIx < lineLength) {
                const char = trimLine[scanIx];
                if (esc) { esc = false; scanIx++; continue; }
                if (char === '\\') { esc = true; scanIx++; continue; }
                if (inQ) { if (char === inQ) inQ = null; scanIx++; continue; }
                if (char === '"' || char === "'") { inQ = char; scanIx++; continue; }

                if (char === '>' || (char === '/' && scanIx + 1 < lineLength && trimLine[scanIx + 1] === '>')) {
                    if (char === '>') { closerLex = '>'; headerEndCol = scanIx + 1; }
                    else { closerLex = '/>'; headerEndCol = scanIx + 2; }
                    break;
                }
                scanIx++;
            }

            const lineNo = currentIx + 1;
            const openCol = currentLine.indexOf('<') + 1;
            const posOpen = _pos(lineNo, openCol, _offset + openCol - 1);

            const leadCol = currentLine.search(/\S|$/) + 1;       /* first non-space col */
            const attrsEndIx = closerLex === '/>' ? scanIx /* '/' */ : scanIx /* '>' */; /* scanIx points at '/' or '>' */
            const rawAttrs = _read_tag_attrs(trimLine, ixHeader /* after name */, attrsEndIx, lineNo, leadCol);

            /* emit open with empty rawAttrs for now; attrs come next pass */
            finalTokens.push(NEW_OPEN_TOKEN(tag, rawAttrs, posOpen));

            /* f.2.2 inline content between header end and closer, if any */
            if (closerLex) {
                const tailStart = headerEndCol;                      /* first char after header */
                const tail = trimLine.slice(tailStart, trimLine.length - (closerLex === '/>' ? 2 : 1)).trim();

                if (tail) {
                    if (tail.startsWith('<') || tail.startsWith('«') || tail.startsWith('[')) {
                        finalTokens.push(...tokenize_hson_NEW(tail, $depth + 1));
                    } else {
                        finalTokens.push(NEW_TEXT_TOKEN(tail, /* quoted */ undefined, posOpen));
                    }
                }

                /* emit the end immediately for same-line closer */
                const posClose = _pos(lineNo, headerEndCol, _offset + headerEndCol - 1);
                const kind = closerLex === '/>' ? CLOSE_KIND.elem : CLOSE_KIND.obj;
                finalTokens.push(NEW_END_TOKEN(kind, posClose));
                _bump_line(currentLine);
                continue;
            } else {
                /* no closer on this line: push a pending cluster; Step E will close it */
                contextStack.push({ type: 'CLUSTER' });  /* close kind decided at Step E */
                _bump_line(currentLine);
                continue;
            }
        } // ---- end of step F ---=|

        _bump_line(currentLine);
        continue;

    } // ---- end while loop ---=|


    /* end-of-file stats */
    _log(
        `[tokenize_hson depth=${$depth}] processed all lines\n` +
        `  contextStack size: ${contextStack.length}\n` +
        `  total tokens: ${finalTokens.length}`
    );

    /* final check — only at top level */
    if ($depth === 0 && contextStack.length > 0) {
        const residual = contextStack.map((c) => {
            if (c.type === 'CLUSTER') return `<cluster ${c.close ?? 'pending'}>`;
            if (c.type === 'IMPLICIT_OBJECT') return '< < (implicit object)';
            /* c.type === 'TAG' if you still use it elsewhere */
            return '<tag?>';
        }).join(', ');
        _throw_transform_err(
            `final check failed: tokenizer finished with ${contextStack.length} unclosed items: ${residual}`,
            'tokenize-hson',
            splitLines
        );
    }

    /* debug print — neutral summary, not the old make_string */
    if (_VERBOSE) {
        console.groupCollapsed('returning tokens (summary)');
        for (const t of finalTokens) {
            switch (t.kind) {
                case TOKEN_KIND.OPEN:
                    console.log(`OPEN <${t.tag}> @ L${t.pos.line}:C${t.pos.col}`);
                    break;
                case TOKEN_KIND.CLOSE:
                    console.log(`END ${t.close} @ L${t.pos.line}:C${t.pos.col}`);
                    break;
                case TOKEN_KIND.ARR_OPEN:
                    console.log(`ARR_OPEN ${t.variant} @ L${t.pos.line}:C${t.pos.col}`);
                    break;
                case TOKEN_KIND.ARR_CLOSE:
                    console.log(`ARR_CLOSE ${t.symbol} @ L${t.pos.line}:C${t.pos.col}`);
                    break;
                case TOKEN_KIND.TEXT:
                    console.log(`TEXT "${t.raw}" @ L${t.pos.line}:C${t.pos.col}`);
                    break;
            }
        }
        console.groupEnd();
    }

    /* return new tokens; no _root wrapping here — parser will handle it */
    return finalTokens as Tokens_NEW[];
}


