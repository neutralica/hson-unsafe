// tokenize-hson.old.hson.ts


import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson";
import { ARR_SYMBOL, CLOSE_KIND, NEW_ARR_CLOSE_TOKEN, NEW_ARR_OPEN_TOKEN, NEW_END_TOKEN, NEW_OPEN_TOKEN, NEW_TEXT_TOKEN, TOKEN_KIND } from "../../types-consts/constants.new.hson";
import { CloseKind, Position, RawAttr, Tokens_NEW } from "../../types-consts/tokens.new.types.hson";
import { split_top_level_NEW } from "./hson-helpers/split-top-2.utils.hson";
import { slice_balanced_arr } from "./hson-helpers/slice-balance.new.utils.hson";
import { lex_text_piece } from "./hson-helpers/lex-text-piece.utils.hson";


/* position tracker */
const _pos = (lineno: number, colno: number, posix: number): Position => ({ line: lineno, col: colno, index: posix });

/* structure for items stored on the context stack */
type ContextStackItem =
    | { type: 'TAG'; tag: string }
    | { type: 'CLUSTER'; close?: CloseKind; implicit?: boolean } /* replaces the old _obj/_elem sentinels */
    | { type: 'IMPLICIT_OBJECT' };

const LONE_OPEN_ANGLE_REGEX = /^\s*<(\s*(\/\/.*)?)?$/;
/* Regex for an implicit object starting on a line, e.g., "< <prop val>>" or "< <" */
const IMPLICIT_OBJECT_START_REGEX = /^\s*<\s*<(\s|$)/; /* ensures second '<' is followed by space or EOL */


const _VERBOSE = true;
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
        _throw_transform_err(`stopping potentially infinite loop (depth >= ${maxDepth})`, 'tokenize_hson');
    }

    const finalTokens: Tokens_NEW[] = [];
    const contextStack: ContextStackItem[] = [];
    const splitLines = $hson.split(/\r\n|\r|\n/);
    let ix = 0;

    _log(`[token_from_hson depth=${$depth}]; total lines: ${splitLines.length}`);

    function ensureQuotedLiteral(lit: string, where: string) {
        const piece = lex_text_piece(lit);
        const t = lit.trim();
        // If it starts with a quote, it must be a *properly closed* quoted literal.
        if ((t.startsWith('"') || t.startsWith("'")) && !piece.quoted) {
            _throw_transform_err(`[${where}] unterminated quoted literal: ${lit}`, 'tokenize-hson');
        }
        return piece; // { text, quoted }
    }

    /* returns true if a bare token should be treated as a primitive value, not a flag */
    function is_primitive_lexeme($s: string): boolean {
        const t = $s.trim();
        if (!t) return false;
        if (t === 'true' || t === 'false' || t === 'null') return true;
        // number-ish (int, float, sci). no +/- signs for attrs; fine to accept here
        return /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(t);
    }

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
        $endIx: number,                  /* start index of the trailing closer in trimLine */
        $lineNo: number,
        $leadCol: number                 /* first non-space col in currentLine (1-based) */
    ): { attrs: RawAttr[]; endIx: number } {
        const out: RawAttr[] = [];
        let ix = $startIx;
        const end = $endIx;

        let inQuote: '"' | "'" | null = null;
        let escaped = false;

        const _col = (relIx: number) => $leadCol + relIx;                 /* 1-based col */
        const _mkpos = (relIx: number): Position => {
            const col = _col(relIx);
            return { line: $lineNo, col, index: _offset + col - 1 };
        };

        const _skip_ws = () => { while (ix < end && /\s/.test($trimLine[ix])) ix++; };

        while (ix < end) {
            _skip_ws();
            if (ix >= end) break;

            /* attr name must start with letter/_/: */
            if (!/[A-Za-z_:]/.test($trimLine[ix])) break;

            const nameStart = ix;
            ix++; while (ix < end && /[\w:.\-]/.test($trimLine[ix])) ix++;
            const name = $trimLine.slice(nameStart, ix);
            const startPos = _mkpos(nameStart);

            _skip_ws();

            if (ix < end && $trimLine[ix] === '=') {
                ix++; _skip_ws();
                let valStart = ix;

                if (ix < end && ($trimLine[ix] === '"' || $trimLine[ix] === "'")) {
                    inQuote = $trimLine[ix] as '"' | "'"; ix++; valStart = ix;
                    while (ix < end) {
                        const ch = $trimLine[ix];
                        if (escaped) { escaped = false; ix++; continue; }
                        if (ch === '\\') { escaped = true; ix++; continue; }
                        if (ch === inQuote) break;
                        ix++;
                    }
                    const text = $trimLine.slice(valStart, ix);
                    if (ix < end && $trimLine[ix] === inQuote) ix++;
                    const endPos = _mkpos(ix);
                    out.push({ name, value: { text, quoted: true }, start: startPos, end: endPos });
                } else {
                    while (ix < end && !/\s/.test($trimLine[ix])) ix++;
                    const text = $trimLine.slice(valStart, ix);
                    const endPos = _mkpos(ix);
                    out.push({ name, value: { text, quoted: false }, start: startPos, end: endPos });
                }
            } else {
                if (is_primitive_lexeme(name)) {
                    return { attrs: out, endIx: nameStart };
                }
                const endPos = _mkpos(ix);
                out.push({ name, start: startPos, end: endPos }); /* flag */
            }
        }

        return { attrs: out, endIx: ix };
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
            contextStack.push({ type: 'CLUSTER', close: CLOSE_KIND.obj, implicit: true }); /* structural intent */
            _bump_line(currentLine);
            continue;
        }

        /* Step C */
        /* handle empty arrays «» */
        if (/^«\s*»\s*$/.test(trimLine) || /^\[\s*\]\s*$/.test(trimLine)) {
            const arrayOpener = trimLine.startsWith('«') ? ARR_SYMBOL.guillemet : ARR_SYMBOL.bracket;
            const col = currentLine.search(/\S|$/) + 1; /* first non-space, 1-based */
            const p = _pos(currentIx + 1, col, _offset + col - 1);

            _log(`[quick]: empty array detected (${arrayOpener})`);
            finalTokens.push(NEW_ARR_OPEN_TOKEN(arrayOpener, p));
            finalTokens.push(NEW_ARR_CLOSE_TOKEN(arrayOpener, p));

            _bump_line(currentLine);
            continue;
        }

        /* Step D */
        /* handle _array delimiters */
        if (trimLine.startsWith('«') || trimLine.startsWith('[')) {
            const opener = trimLine.startsWith('«') ? '«' : '[';
            const closer = opener === '«' ? '»' : ']';
            const closerSymbol = opener === '«' ? ARR_SYMBOL.guillemet : ARR_SYMBOL.bracket;

            _log(`[tokenize_hson]: processing array (${closerSymbol})`);

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

            finalTokens.push(NEW_ARR_OPEN_TOKEN(closerSymbol, pOpen));

            /* split the array body by top-level commas (quote/array/header aware) */
            const items = split_top_level_NEW(body, ',');

            for (const itemRaw of items) {
                const item = itemRaw.trim();
                if (!item) continue;

                if (item.startsWith('<') || item.startsWith('«') || item.startsWith('[')) {
                    finalTokens.push(...tokenize_hson_NEW(item, $depth + 1));
                } else {
                    // NEW: quote-aware, without endIx
                    const piece = ensureQuotedLiteral(item, 'array');
                    finalTokens.push(
                        NEW_TEXT_TOKEN(piece.text, piece.quoted ? true : undefined, pOpen)
                    );
                }
            }


            finalTokens.push(NEW_ARR_CLOSE_TOKEN(closerSymbol, pClose));

            /* advance main loop to the line containing the closer */
            _bump_array(linesConsumed + 1);
            continue;
        }

        /* step E */
        const closerMatch = currentLine.match(/^\s*(\/?>)\s*(?:\/\/.*)?$/);
        if (closerMatch) {
            const closerLex = closerMatch[1];
            if (closerLex) {
                const close = closerLex === '/>' ? CLOSE_KIND.elem : CLOSE_KIND.obj;
                const col = currentLine.indexOf(closerLex) + 1;
                const pos = _pos(currentIx + 1, col, _offset + col - 1);

                const top = contextStack[contextStack.length - 1];
                if (!top || top.type !== 'CLUSTER') {
                    _throw_transform_err(`[step e] closer '${closerLex}' but stack top is ${JSON.stringify(top)}`, 'tokenize-hson');
                }
                if (top.close && top.close !== close) {
                    _throw_transform_err(`[step e] mismatched closer '${closerLex}' for cluster '${top.close}'`, 'tokenize-hson');
                }

                // pop cluster and optionally emit END
                const popped = contextStack.pop() as Extract<ContextStackItem, { type: 'CLUSTER' }>;
                if (!popped.implicit) {
                    finalTokens.push(NEW_END_TOKEN(close, pos));   // only for real OPENs
                } else {
                    _log(`[step e] suppress END for implicit cluster at L${currentIx + 1}`);
                }

                // clean up implicit marker if present
                const maybeImplicit = contextStack[contextStack.length - 1];
                if (maybeImplicit && maybeImplicit.type === 'IMPLICIT_OBJECT' && close === CLOSE_KIND.obj) {
                    contextStack.pop();
                }

                _bump_line(currentLine);
                continue;
            }
        }

        /* step F: open tags */



        if (trimLine.startsWith('<')) {

            /* f.1 implicit object opener "< <...": accept preamble, no tokens, structure only */
            if (IMPLICIT_OBJECT_START_REGEX.test(trimLine)) {
                _log(`[step f depth=${$depth} L=${currentIx + 1}] implicit object opener`);
                contextStack.push({ type: 'IMPLICIT_OBJECT' });
                contextStack.push({ type: 'CLUSTER' });/* pending close kind */

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
            let ixHeader = 1;                               /* after '<' */
            const lineLen = trimLine.length;
            while (ixHeader < lineLen && /\s/.test(trimLine[ixHeader])) ixHeader++;

            const tagNameStartIx = ixHeader;
            while (ixHeader < lineLen && /[A-Za-z0-9:._-]/.test(trimLine[ixHeader])) ixHeader++;
            const tag = trimLine.slice(tagNameStartIx, ixHeader);
            if (!tag) _throw_transform_err(`[step f depth=${$depth} L=${currentIx + 1}] malformed tag in "${trimLine}"`, 'tokenize-hson');

            const lineNo = currentIx + 1;
            const leadCol = currentLine.search(/\S|$/) + 1;          /* first non-space col */
            const colOpen = leadCol;                                  /* '<' sits here */
            const posOpen = _pos(lineNo, colOpen, _offset + colOpen - 1);

            /* f.3 detect trailing closer @ end of the raw line (ignore //comment) */
            const mTrail = currentLine.match(/(\/?>)\s*(?:\/\/.*)?$/);
            const closerLex = mTrail ? (mTrail[1] as ('>' | '/>')) : null;

            let rawAttrs: RawAttr[] = [];
            let tailRaw = '';

            /* compute relative indices against trimLine */
            const leadSpaces = currentLine.match(/^\s*/)?.[0].length ?? 0;

            if (closerLex) {
                const closerLen = closerLex === '/>' ? 2 : 1;

                /* absolute index of the closer in currentLine */
                const closerAbs = currentLine.lastIndexOf(closerLex);
                if (closerAbs < 0) {
                    _throw_transform_err(`internal: trailing closer not found in "${currentLine}"`, 'tokenize-hson', currentLine);
                }

                /* relative index inside trimLine */
                const closerRel = Math.max(0, closerAbs - leadSpaces);

                /* parse attrs up to the closer; capture where we stopped for tail */
                const { attrs, endIx: attrsEndIx } =
                    _read_tag_attrs(trimLine, ixHeader /* after name */, closerRel, lineNo, leadCol);

                rawAttrs = attrs;

                /* anything between attrs end and trailing closer is the inline tail */
                tailRaw = trimLine.slice(attrsEndIx, closerRel).trim();
            } else {
                /* no same-line closer: parse attrs until we can’t read more */
                const { attrs } = _read_tag_attrs(trimLine, ixHeader, trimLine.length, lineNo, leadCol);
                rawAttrs = attrs;
            }

            /* emit open */
            finalTokens.push(NEW_OPEN_TOKEN(tag, rawAttrs, posOpen));

            /* inline tail (if any) */
            if (tailRaw) {
                if (tailRaw.startsWith('<') || tailRaw.startsWith('«') || tailRaw.startsWith('[')) {
                    finalTokens.push(...tokenize_hson_NEW(tailRaw, $depth + 1));
                } else {
                    const parts = split_top_level_NEW(tailRaw, ',');
                    if (parts.length > 1) {
                        _throw_transform_err(
                            `[step f] multiple inline items not allowed after <${tag}>: "${tailRaw}"`,
                            'tokenize-hson'
                        );
                    }
                    const lit = parts[0].trim();

                    // NEW: quote-aware, without endIx
                    const piece = ensureQuotedLiteral(lit, 'step f');
                    finalTokens.push(
                        NEW_TEXT_TOKEN(piece.text, piece.quoted ? true : undefined, posOpen)
                    );
                }
            }

            /* close now or defer to step e */
            if (closerLex) {
                const closerLen = closerLex === '/>' ? 2 : 1;
                const colCloserAbs = leadCol + (trimLine.length - closerLen);
                const posClose = _pos(lineNo, colCloserAbs, _offset + colCloserAbs - 1);
                const closeKind = (closerLex === '/>') ? CLOSE_KIND.elem : CLOSE_KIND.obj;
                finalTokens.push(NEW_END_TOKEN(closeKind, posClose));
                _bump_line(currentLine);
                continue;
            } else {
                contextStack.push({ type: 'CLUSTER' });  /* pending: Step E will close */
                _bump_line(currentLine);
                continue;
            }
        } // ---- end of step F ---=|


        /* step G: standalone text/primitive lines */
        {
            /*  ignore trailing // comments, but keep the literal exactly */
            const m = currentLine.match(/^\s*(.+?)(?:\s*\/\/.*)?\s*$/);
            const body = m ? m[1] : '';

            /* quick checks for a standalone literal */
            const isQuoted = body.startsWith('"') && body.endsWith('"');
            const isPrim = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(body);

            if (isQuoted || isPrim) {
                const lead = currentLine.match(/^\s*/)?.[0].length ?? 0;
                const p = _pos(ix + 1, lead + 1, _offset + lead);
                /* IMPORTANT: pass the raw text as-is; let the parser's coerce() handle it. */
                /* set quoted = undefined so the parser uses coerce for both quoted and unquoted here. */
                finalTokens.push(NEW_TEXT_TOKEN(body, undefined, p));
                _bump_line(currentLine);
                continue;
            }
        }

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
        _throw_transform_err(`final check failed: tokenizer finished with ${contextStack.length} unclosed items: ${residual}`, 'tokenize-hson');
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
                    console.log(`ARR_OPEN ${t.symbol} @ L${t.pos.line}:C${t.pos.col}`);
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


