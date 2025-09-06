// tokenize-hson.old.hson.ts

import { Primitive } from "../../../core/types-consts/core.types.hson";
import { is_not_string, is_Primitive } from "../../../core/utils/guards.core.utils.hson";
import { CREATE_TOKEN, TokenΔ, OBJ_TAG, ARR_TAG, ELEM_TAG, ROOT_TAG } from "../../../types-consts/constants.hson";
import { HsonAttrs, HsonFlags } from "../../../types-consts/node.types.hson";
import { AllTokens, HSON_Token_Type } from "../../../types-consts/tokens.types.hson";
import { close_tag_lookahead } from "../../../utils/close-tag-lookahead.utils.hson";
import { coerce } from "../../../utils/coerce-string.utils.hson";
import { make_string } from "../../../utils/make-string.utils.hson";
import { is_Node } from "../../../utils/node-guards.utils.hson";
import { parse_style_hard_mode } from "../../../utils/parse-css.utils.hson";
import { split_top_OLD } from "../../../utils/split-top-level.utils.hson";
import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson";

/* structure for items stored on the context stack */
type ContextStackItem =
    | { type: 'TAG'; tag: string; isImplicitContent?: boolean }
    | { type: 'IMPLICIT_OBJECT'; tag?: '_imp'; isImplicitContent?: never };

const LONE_OPEN_ANGLE_REGEX = /^\s*<(\s*(\/\/.*)?)?$/;
/* Regex for an implicit object starting on a line, e.g., "< <prop val>>" or "< <" */
const IMPLICIT_OBJECT_START_REGEX = /^\s*<\s*<(\s|$)/; /* ensures second '<' is followed by space or EOL */


const _VERBOSE = false;
const $log = _VERBOSE
    ? console.log
    : () => { };
let tokenFirst: boolean = true;

export function tokenize_hson_OLD($hson: string, $depth = 0): AllTokens[] {
    const maxDepth = 50;
    $log(`[token_from_hson called with depth=${$depth}]`);
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

    const finalTokens: AllTokens[] = [];
    const contextStack: ContextStackItem[] = [];
    const splitLines = $hson.split(/\r\n|\r|\n/);
    let ix = 0;

    $log(`[token_from_hson depth=${$depth}]; total lines: ${splitLines.length}`);

    while (ix < splitLines.length) {
        const currentIx = ix;
        const currentLine = splitLines[ix];
        const trimLine = currentLine.trim();

        $log(`[token_from_hson depth=${$depth} L=${currentIx + 1}/${splitLines.length}]: processing: "${trimLine}" (Original: "${currentLine}")`);
        /* skip empty/comment lines */
        if (!trimLine || trimLine.startsWith('//')) {
            $log(`[token_from_hson depth=${$depth} L=${currentIx + 1}] skipping comment/empty`);
            ix++;
            continue;
        }

        /* check for '<' implicit object trigger */
        if (LONE_OPEN_ANGLE_REGEX.test(currentLine)) {
            $log(`[token_from_hson depth=${$depth} L=${currentIx + 1}] lone '<' detected`);
            finalTokens.push(CREATE_TOKEN({ type: TokenΔ.OPEN, tag: OBJ_TAG }));
            contextStack.push({ type: 'IMPLICIT_OBJECT' });
            ix++;
            continue;
        }

        /* handle empty arrays «» */
        if (trimLine.match(/^«\s*»/)) {
            $log(`[quick check]: found and processed an empty inline array («»)`);
            finalTokens.push(CREATE_TOKEN({ type: TokenΔ.ARRAY_OPEN, tag: ARR_TAG }));
            /* no content tokens needed */
            finalTokens.push(CREATE_TOKEN({ type: TokenΔ.ARRAY_CLOSE, tag: ARR_TAG }));

            ix++; /* consume line */
            continue; /* move on to the next line, skipping logic below */
        }

        /* handle _array delimiters */
        if (trimLine.startsWith('«')) {
            const opener = '«';
            const closer = '»';
            const tag = ARR_TAG;
            const type = TokenΔ.ARRAY_OPEN;
            const closeToken = TokenΔ.ARRAY_CLOSE;

            $log(`[tokenize_hson]: processing array tags`);
            finalTokens.push(CREATE_TOKEN({ type, tag }));

            /* find the full content of the block first, respecting nesting. */
            let array_content = '';
            let startIx = currentLine.indexOf(opener) + 1;
            let nestedDepth = 1;
            let currentIx = ix;
            let lineXPos = startIx;

            while (nestedDepth > 0 && currentIx < splitLines.length) {
                const currentLine = splitLines[currentIx];
                for (let j = lineXPos; j < currentLine.length; j++) {
                    if (currentLine.startsWith(opener, j)) {
                        nestedDepth++;
                    } else if (currentLine.startsWith(closer, j)) {
                        nestedDepth--;
                        if (nestedDepth === 0) {
                            /* should have found the final closer; extract content */
                            const allLines = splitLines.slice(ix, currentIx + 1);
                            let joinedLines = allLines.join('\n');
                            let startPos = joinedLines.indexOf(opener) + 1;
                            let endPos = joinedLines.lastIndexOf(closer);
                            array_content = joinedLines.substring(startPos, endPos);

                            ix = currentIx; /* move main loop index forward */
                            break;
                        }
                    }
                }
                if (nestedDepth === 0) break; /* exit outer loop */
                currentIx++;
                lineXPos = 0; /* reset for next line */
            }

            if (nestedDepth !== 0) {
                _throw_transform_err(`unmatched ${opener}${closer} starting near line ${currentIx + 1}`, 'tokenize_hson', $hson);
            }

            /* process the extracted content string */
            if (array_content.trim()) {
                const strings = split_top_OLD(array_content, ','); /* split by top-level commas */
                for (const str of strings) {
                    const trimmed = str.trim();
                    if (trimmed) {
                        if (trimmed.startsWith('<') || trimmed.startsWith('«')) {
                            finalTokens.push(...tokenize_hson_OLD(trimmed, $depth + 1));
                        } else {
                            const coerced = coerce(trimmed);
                            const type = is_not_string(coerced) ? TokenΔ.VAL_CONTENTS : TokenΔ.STR_CONTENTS
                            finalTokens.push(CREATE_TOKEN({ type, content: [coerced] }));
                        }
                    }
                }
            }

            finalTokens.push(CREATE_TOKEN({ type: closeToken, tag }));
            ix++; /* consume the closer line */
            continue;
        }

        /* step E: handle closers (>, />) */

        if (trimLine === ">" || trimLine === "/>") {
            if (contextStack.length === 0) {
                _throw_transform_err(`[Step E] closer '${trimLine}' found but context stack is empty at L${ix + 1}`, 'tokenize-hson', currentLine);
            }

            const topStack: ContextStackItem = contextStack[contextStack.length - 1]; // Peek

            let is_lineConsumed = false;

            /* check if topStack is an implicit content VSN  */
            if (topStack.type === 'TAG' && topStack.isImplicitContent === true) {
                /* (topContext.tag will be OBJECT_TAG or ELEM_TAG) */

                const VsnContentTag = contextStack.pop() as Extract<ContextStackItem, { type: 'TAG'; isImplicitContentForParent?: true }>;
                const StdParentTag = contextStack.pop() as Extract<ContextStackItem, { type: 'TAG' }>; /* assumes it's always there and is TAG */

                /* close the VSN */
                finalTokens.push(CREATE_TOKEN({
                    type: (VsnContentTag.tag === ELEM_TAG) ? TokenΔ.ELEM_CLOSE : TokenΔ.OBJ_CLOSE,
                    tag: VsnContentTag.tag
                }));
                $log(`step E: closed implicit object <${VsnContentTag.tag}> for parent <${StdParentTag.tag}>`);

                /* close/consume the line */
                finalTokens.push(CREATE_TOKEN({ type: TokenΔ.CLOSE, tag: StdParentTag.tag }));
                $log(`[Step E] standard parent tag <${StdParentTag.tag} closed by line '${trimLine}'`);

                is_lineConsumed = true;
            }
            /* check 2: explicit tags get single .pop() */
            else if (topStack.type === 'TAG') {
                const stackCloser = contextStack.pop() as Extract<ContextStackItem, { type: 'TAG' }>;

                /*  validate closer if needed */
                if (stackCloser.tag === ELEM_TAG && trimLine !== "/>") {
                    console.warn(`step E: [WARN]:\n  <_elem tag <${stackCloser.tag} closes with '${trimLine}' instead of '/>'`);
                } else if (stackCloser.tag === OBJ_TAG && trimLine !== ">") {
                    console.warn(`step E: [WARN]:\n <_obj tag <${stackCloser.tag} closes with '${trimLine}' instead of '>'`);
                }

                $log(`[Step E] closing tag <${stackCloser.tag}> with line '${trimLine}'.`);
                let finalTokenType: HSON_Token_Type;
                switch (stackCloser.tag) {
                    case ELEM_TAG: finalTokenType = TokenΔ.ELEM_CLOSE; break;
                    case ARR_TAG: finalTokenType = TokenΔ.ARRAY_CLOSE; break;
                    case OBJ_TAG: finalTokenType = TokenΔ.OBJ_CLOSE; break;
                    default: finalTokenType = TokenΔ.CLOSE; break; /* for standard tags */
                }
                finalTokens.push(CREATE_TOKEN({ type: finalTokenType, tag: stackCloser.tag }));
                is_lineConsumed = true;
            }

            else if (topStack.type === 'IMPLICIT_OBJECT' && trimLine === ">") {
                contextStack.pop();
                $log(`[Step E] closing 'IMPLICIT_OBJECT' context with '>'`);
                finalTokens.push(CREATE_TOKEN({ type: TokenΔ.OBJ_CLOSE, tag: OBJ_TAG }));
                is_lineConsumed = true;
            }

            if (is_lineConsumed) {
                ix++;
                continue;
            } else {
                console.warn(`[Step E] [FALLBACK]: line '${trimLine}' is a closer, but stack top ${JSON.stringify(topStack)} didn't match an expected closing pattern`);
            }
        }

        /* step F */
        if (trimLine.startsWith('<')) {

            /*  F.1: Implicit object start < <...> 
                (currently not valid HSON but should be accepted some day) */
            if (IMPLICIT_OBJECT_START_REGEX.test(trimLine)) {
                $log(`[Step F depth=${$depth} L=${currentIx + 1}] implicit object opener detected`);
                finalTokens.push(CREATE_TOKEN({ type: TokenΔ.OPEN, tag: OBJ_TAG }));
                contextStack.push({ type: 'IMPLICIT_OBJECT' });
                const startIx = trimLine.indexOf('<', trimLine.indexOf('<') + 1);
                const innerContent = startIx !== -1 ? trimLine.substring(startIx).trim() : "";
                if (innerContent) {
                    $log(`[step F - depth=${$depth} L=${currentIx + 1}] ---> recursing implicit object content: "${innerContent}"`);
                    const inner_tokens = tokenize_hson_OLD(innerContent, $depth + 1);
                    finalTokens.push(...inner_tokens);
                    $log(`[Step F - depth=${$depth} L=${currentIx + 1}] <--- exited recursion for implicit object.`);
                }
                ix++;
                continue;
            }

            /* F.2: parse named tags, flags, attributes */
            let parsedChars = 1; /* start after opener */
            const lineLength = trimLine.length;

            /* skip initial whitespace */
            while (parsedChars < lineLength && /\s/.test(trimLine[parsedChars])) parsedChars++;

            /* get tag name */
            const tagNameStart = parsedChars;
            while (parsedChars < lineLength && /[a-zA-Z0-9:._-]/.test(trimLine[parsedChars])) parsedChars++;
            const tag = trimLine.substring(tagNameStart, parsedChars);

            if (!tag) {
                _throw_transform_err(`[step F depth=${$depth} L=${currentIx + 1}] malformed tag: could not get tag name in "${trimLine}"`, 'tokenize-hson', currentLine);
            }


            const attrs: HsonAttrs = {};
            const flags: HsonFlags = [];
            let nodeContent: Primitive | undefined = undefined;
            let arrayContent: string | undefined = undefined;
            let selfCloses = false;
            let parseError = false;

            const inlineContent: (Primitive | AllTokens | { type: 'HSON_ARRAY_SHORTHAND', hsonString: string })[] = [];


            /* parse attrs and flags */

            PHASE_1_ATTR_FLAGS: while (parsedChars < lineLength) {
                const loopPos = parsedChars;
                while (parsedChars < lineLength && /\s/.test(trimLine[parsedChars])) parsedChars++; /* skip whitespace */

                const remainder = trimLine.substring(parsedChars);


                if (parsedChars === lineLength || remainder.startsWith('>') || remainder.startsWith('/>')) {
                    break PHASE_1_ATTR_FLAGS;
                }

                /* check for content */
                const is_Start =
                    remainder.startsWith('<') || /* nested tag */
                    remainder.startsWith('«') || /* array shorthand */
                    remainder.match(/^("((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/) || /* quoted string */
                    remainder.match(/^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s|$|>|<|«)/); /* unquoted primitive */

                if (is_Start) {
                    $log(`[step F phase 1] Detected start of content. Moving to Phase 2. Remaining: "${remainder.substring(0, 10)}"`);
                    break PHASE_1_ATTR_FLAGS;
                }

                /* parse attribute */
                const attrsMatch = remainder.match(/^([a-zA-Z0-9:._-]+)\s*=\s*("((?:[^"\\]|\\.)*)")/);

                if (attrsMatch) {
                    const key = attrsMatch[1];
                    const valueString = attrsMatch[3];

                    /* handle the 'style' attribute differently */
                    if (key === 'style') {
                        try {
                            /* try to parse style attributes for direct manipulation in JSON */
                            attrs.style = parse_style_hard_mode(valueString);
                        } catch (e) {
                            _throw_transform_err(`parse error in tokenize_hson(): failed to JSON.parse style attribute: ${valueString}: ${e}`, 'tokenize-hson', remainder);
                            parseError = true;
                        }
                    } else {
                        attrs[key] = coerce(attrsMatch[2]);
                    }

                    parsedChars += attrsMatch[0].length;
                    $log(`[step F phase 1] ATTR: ${key}=${JSON.stringify(attrs[key])}. parsePos=${parsedChars}`);
                    continue PHASE_1_ATTR_FLAGS;
                }
                /*  parse flags */
                const flagMatch = remainder.match(/^([^'"\s/>«<=\]]+)/); /* look for unquoted token */
                if (flagMatch) {
                    const token_string = flagMatch[0];
                    /* ensure it's not followed by '=' */
                    let lookaheadDistance = parsedChars + token_string.length;
                    while (lookaheadDistance < trimLine.length && /\s/.test(trimLine[lookaheadDistance])) lookaheadDistance++;

                    if (trimLine[lookaheadDistance] === '=') {
                        console.warn(`[step F phase 1] flag "${token_string}" is followed by "=": likely malformed attr/flag`);
                        parseError = true;
                        break PHASE_1_ATTR_FLAGS;
                    }

                    flags.push(token_string);
                    parsedChars += token_string.length;
                    $log(`[step F phase 1] FLAG: ${token_string}. parsePos=${parsedChars}`);
                    continue PHASE_1_ATTR_FLAGS;
                }

                if (parsedChars === loopPos) {
                    _throw_transform_err(`[step F phase 1] unparseable segment OR stuck in attr/flag parsing for <${tag}>\nremaining: "${remainder.substring(0, 100)}"`, 'tokenize-hson', remainder);
                }
            } // ---- end phase 1: attr/flag parsing ---=|

            /*  phase 2: parse content  */
            if (!parseError) {
                PHASE_2_CONTENT_ITEMS: while (parsedChars < lineLength) {
                    const loopPos = parsedChars;
                    /* skip whitespace before next token */
                    while (parsedChars < lineLength && /\s/.test(trimLine[parsedChars])) parsedChars++;

                    const remainder = trimLine.substring(parsedChars);

                    /* check for end of tag on this line */
                    if (remainder.startsWith("/>")) {
                        selfCloses = true;
                        parsedChars += 2; /* consume '/>' */
                        $log(`[step F phase 2] <${tag}  consumed self-closing '/>'\n Ending content parse`);
                        break PHASE_2_CONTENT_ITEMS;
                    }
                    if (remainder.startsWith('>')) {
                        selfCloses = true;
                        parsedChars += 1;
                        $log(`[step F phase 2] <${tag} consumed closing '>'\n  ending content parse`);
                        break PHASE_2_CONTENT_ITEMS;
                    }
                    if (parsedChars === lineLength) {
                        break PHASE_2_CONTENT_ITEMS;
                    }

                    /* try to parse different types of content items */
                    let contentMatch = false;

                    /* check for nested HSON tag: <...> (currently not valid) */
                    if (remainder.startsWith('<')) {
                        let balance = 0;
                        let nestedIx = -1;
                        for (let k = 0; k < remainder.length; k++) {
                            if (remainder[k] === '<') balance++;
                            else if (remainder[k] === '>') {
                                balance--;
                                if (balance === 0) {
                                    nestedIx = k;
                                    break;
                                }
                            }
                        }
                        if (nestedIx !== -1) {
                            const nested_tag_string = remainder.substring(0, nestedIx + 1);
                            $log(`[step F phase 2] <${tag}\n found nested HSON: "${nested_tag_string}" -- recursing`);
                            const nested_tokens = tokenize_hson_OLD(nested_tag_string, $depth + 1);
                            /* wrap the sequence of tokens to distinguish it from other item types */
                            inlineContent.push({ type: 'TOKEN_SEQUENCE', tokens: nested_tokens } as any);
                            parsedChars += nested_tag_string.length;
                            contentMatch = true;
                        } else {
                            _throw_transform_err(`[step F phase 2] <${tag}\n malformed nested tag: no closer ('>' or '/>')`, 'tokenize-hson', remainder);
                            parseError = true;
                        }
                    }
                    /* array shorthand: «...» */
                    else if (remainder.startsWith('«') || remainder.startsWith('[')) {
                        const is_emptyArray = remainder.startsWith('«»');
                        const is_emptyBrackets = remainder.startsWith('[]');

                        if (is_emptyArray || is_emptyBrackets) {
                            $log(`[step F phase 2] <${tag}> found empty array shorthand.`);
                            inlineContent.push('«»');
                            parsedChars += 2;
                            contentMatch = true;
                        }
                        // delete???:
                        // else {
                        //     // TODO: Handle non-empty arrays here
                        //     console.error(`[step F phase 2] <${tag}> Non-empty arrays are not yet supported.`);
                        //     parseError = true;
                        // }
                    }
                    /* try quoted string primitive */
                    else {
                        const quotedRegex = remainder.match(/^("((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/);
                        if (quotedRegex) {
                            try {
                                inlineContent.push(JSON.parse(quotedRegex[0]));
                            } catch (e) {
                                parseError = true;
                                inlineContent.push(quotedRegex[2] ?? quotedRegex[3]); /* (fallback) */
                            }
                            parsedChars += quotedRegex[0].length;
                            contentMatch = true;
                        }
                        /* try unquoted primitive */
                        else {
                            const unquotedRegex = /^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s|$|>|<|«)/;
                            const unquotedMatch = remainder.match(unquotedRegex);
                            if (unquotedMatch) {
                                const matchedStr = unquotedMatch[0];
                                let primitiveValue: Primitive;
                                if (matchedStr === "true") primitiveValue = true;
                                else if (matchedStr === "false") primitiveValue = false;
                                else if (matchedStr === "null") primitiveValue = null;
                                else primitiveValue = parseFloat(matchedStr);

                                inlineContent.push(primitiveValue);
                                parsedChars += matchedStr.length;
                                contentMatch = true;
                            }
                        }
                    }

                    if (parseError) break PHASE_2_CONTENT_ITEMS;

                    if (!contentMatch) {
                        _throw_transform_err(`[step F phase 2] <${tag} unparseable content\n remaining: "${remainder.substring(0, 20)}"`, 'tokenize-hson', remainder);

                    }
                    /* infinite loop check */
                    if (parsedChars === loopPos) {
                        _throw_transform_err(`[step F phase 2] <${tag} parser stuck in loop: aborting parse`, 'tokenize-hson', remainder);
                    }
                } // ---- end PHASE_2_CONTENT_ITEMS ---=|
            }

            /* step F.3 - determine token type, push */
            if (parseError) {
                _throw_transform_err('PARSER ERROR—creating generic fallback text token', 'tokenize_hson', currentLine)
                finalTokens.push(CREATE_TOKEN({ type: TokenΔ.STR_CONTENTS, content: ['[ERROR IN PARSING STEP F.3'] }));
            } else {
                const meta = { attrs, flags };
                let can_selfClose = true;
                const selfContent: Primitive[] = [];

                /* helper function to process inline content items into tokens */
                function emitInlineTokens(
                    $elements: (Primitive | AllTokens | { type: 'HSON_ARRAY_SHORTHAND', hsonString: string } | { type: 'TOKEN_SEQUENCE', tokens: AllTokens[] })[],
                    $outputTokens: AllTokens[],
                    $currentTagName: string, /*  (for logging context) */
                    $currentRecursionDepth: number /* or recursive token_from_hson calls */
                ) {
                    for (const element of $elements) {
                        if (element !== null && typeof element === 'object' && (element as any).type === 'HSON_ARRAY_SHORTHAND') {
                            const arrayString = (element as any).hsonString;
                            $outputTokens.push(CREATE_TOKEN({ type: TokenΔ.ARRAY_OPEN, tag: ARR_TAG }));
                            const innerContent = arrayString.slice(1, -1).trim();

                            const tempTokens: AllTokens[] = [];
                            if (innerContent) {
                                const is_complex = innerContent.includes('<') || innerContent.includes('«');
                                if (is_complex) {
                                    const complexItems = split_top_OLD(innerContent, ',');
                                    for (const item of complexItems) {
                                        const trimmed = item.trim();
                                        if (trimmed) {
                                            tempTokens.push(...tokenize_hson_OLD(trimmed, $currentRecursionDepth + 1));
                                        }
                                    }
                                } else {
                                    split_top_OLD(innerContent, ',').forEach(itemStr => {
                                        const trimmed = itemStr.trim();
                                        if (trimmed) {
                                            const coercedItem = coerce(trimmed);
                                            const type = (is_not_string(coercedItem)) ? TokenΔ.VAL_CONTENTS : TokenΔ.STR_CONTENTS;
                                            tempTokens.push(CREATE_TOKEN({ type, content: [coercedItem] }));
                                        }
                                    });
                                }
                            }
                            $log(`[emitInlineContentTokens ArrayDebug] <${$currentTagName}> Generated item tokens for array: JSON.stringify(tempItemTokens))`);
                            $outputTokens.push(...tempTokens);
                            $outputTokens.push(CREATE_TOKEN({ type: TokenΔ.ARRAY_CLOSE, tag: ARR_TAG }));

                        } else if (element !== null && typeof element === 'object' && (element as any).type === 'TOKEN_SEQUENCE') {
                            $outputTokens.push(...(element as any).tokens);
                        } else if (element !== null && typeof element === 'object' && (element as AllTokens).tag !== undefined && typeof (element as AllTokens).type === 'string') {
                            $outputTokens.push(element as AllTokens);
                        } else if (is_Primitive(element)) {
                            const type = (is_not_string(element)) ? TokenΔ.VAL_CONTENTS : TokenΔ.STR_CONTENTS;
                            $outputTokens.push(CREATE_TOKEN({ type, content: [element as Primitive] }));
                        }
                    }
                }

                if (inlineContent.length === 0) {

                } else for (const item of inlineContent) {
                    /* determine if the tag's content can be represented by a SELF token (i.e., only primitives or empty) */
                    if (is_Node(item)) {
                        can_selfClose = false;
                        break;
                    }
                    selfContent.push(item as Primitive);
                }


                if (selfCloses) {
                    /* tag closes on same line it opens;
                        check if there's an array or complex content */
                    const has_array = inlineContent.some(el => is_Node(el) && (el as any).type === 'HSON_ARRAY_SHORTHAND');

                    if (!can_selfClose || has_array) {
                        /* case A: content is nested HsonNodes or an array shorthand was found */
                        // this should never be reached?
                        console.warn('should this ever be reached??? methinks not?')
                        $log(`[step F phase 3] <${tag} closes on same line >, not complex content or array\nemitting OPEN/items/CLOSE`);
                        finalTokens.push(CREATE_TOKEN({ type: TokenΔ.OPEN, tag: tag, attrs: meta.attrs, flags: meta.flags }));

                        emitInlineTokens(inlineContent, finalTokens, tag, $depth);

                        finalTokens.push(CREATE_TOKEN({ type: TokenΔ.CLOSE, tag: tag, attrs: {}, flags: [] }));
                    } else {
                        /* Case B: `can_selfClose` is TRUE (one BasicValue inlineContentItems, or it's empty)
                            AND the tag closes on the same line.
                            Output: SELF("_tag", _content: [primitives]) */
                        $log(`[step F phase 3] <${tag} is SELF\n  content: ${make_string(selfContent)})`);
                        finalTokens.push(CREATE_TOKEN({
                            type: TokenΔ.SELF,
                            tag: tag,
                            attrs: meta.attrs,
                            flags: meta.flags,
                            content: selfContent
                        }));
                    }

                } else {
                    /* Case C: Does NOT close on this line (hasExplicitClosingAngleOnLine is false) */
                    const currentIndent = (splitLines[ix].match(/^(\s*)/)?.[0]?.length || 0) / 2;
                    let is_array = false;

                    const remainingContent = trimLine.substring(parsedChars); /* content is on current line after <tagName attrs> */
                    if (remainingContent.trim().startsWith('«')) {
                        /* for when e.g., <tagName ... « (optional further inline items for array)
                            OR <tagName ... «» (if phase 2 didn't make it a SELF tag)
                            if this '«' is the start of the primary value for tagName */
                        is_array = true;
                        $log(`[step F phase 3] <${tag}> has '«' on its opening line\n  assuming direct array content`);
                    } else if (inlineContent.length === 0 && (ix + 1 < splitLines.length)) {
                        /*  No significant inline content on current line. Check next non-empty/comment line */
                        let nextLineIx = ix + 1;
                        while (nextLineIx < splitLines.length &&
                            (splitLines[nextLineIx].trim() === "" || splitLines[nextLineIx].trim().startsWith("//"))) {
                            nextLineIx++;
                        }
                        if (nextLineIx < splitLines.length && splitLines[nextLineIx].trim().startsWith('«')) {
                            is_array = true;
                            $log(`[step F phase 3] <${tag} content on next line (L${nextLineIx + 1}) starts with '«' -- assuming direct array content`);
                        }
                    }

                    /* emit tokens based on whether it's a direct array or a general block */
                    finalTokens.push(CREATE_TOKEN({
                        type: TokenΔ.OPEN,
                        tag,
                        attrs: meta.attrs,
                        flags: meta.flags
                    }));
                    contextStack.push({
                        type: 'TAG',
                        tag,
                    } as ContextStackItem);

                    if (is_array) {
                        /* content is an array; step C handles '«...»'
                         and emit ARRAY_OPEN(_array) which becomes a child of 'tagName'
                         NO implicit _obj or _elem wrapper here (_array wrapper handles the cluster) */
                        $log(`[step F phase 3] <${tag} is OPEN, expecting direct array content (from «).`);

                        /* if 'inlineContentItems' were collected by phase 2 *from this line*,
                            AND 'opensDirectArrayShorthand' is true because '«' was found: */
                        if (inlineContent && inlineContent.length > 0) {
                            $log(`[step F phase 3] Emitting ${inlineContent.length} inline content items for <${tag}> (which is opening for an array)`);
                            /* emitInlineContentTokens processes HSON_ARRAY_SHORTHAND and emits ARRAY_OPEN etc. */
                            emitInlineTokens(inlineContent, finalTokens, tag /* parent is tagName */, $depth);
                        }
                        /* If the '«' is at the very end of the current line,
                            inlineContentItems might be empty here for items *after* '«'.
                            The next line will be handled by Step C. */

                    } else {
                        /* Content is a general block not an immediate array--usse closeTagLookahead. */
                        $log(`[step F phase 3] <${tag}> at L${ix + 1} is OPEN (standard block)\n  determining content type via closeTagLookahead()`);
                        const closing_tag = close_tag_lookahead(splitLines, ix, tag);
                        $log(`[step F phase 3] <${tag}> determined HSON content type: ${closing_tag}`);

                        let contentVSNTag: string;
                        let contentVSNType: HSON_Token_Type;
                        if (closing_tag === ELEM_TAG) {
                            contentVSNTag = ELEM_TAG; contentVSNType = TokenΔ.ELEM_OPEN;
                        } else if (closing_tag === OBJ_TAG) {
                            contentVSNTag = OBJ_TAG; contentVSNType = TokenΔ.OBJ_OPEN;
                        } else {  /*  default is smell? */
                            contentVSNTag = tag;
                            contentVSNType = TokenΔ.OBJ_OPEN;
                        }

                        finalTokens.push(CREATE_TOKEN({ type: contentVSNType, tag: contentVSNTag, attrs: {}, flags: [] }));
                        contextStack.push({
                            type: 'TAG',
                            tag: contentVSNTag,
                            indent: currentIndent + 1,
                            isImplicitContent: true /* flag for step E */
                        } as ContextStackItem);
                        $log(`[step F phase 3] emitted ${[contentVSNType]} (${contentVSNTag}) for content of <${tag}>\n stack top: ${contentVSNTag}`);

                        /* any inlineContentItems found on the opening line become children */
                        if (inlineContent && inlineContent.length > 0) {
                            emitInlineTokens(inlineContent, finalTokens, contentVSNTag, $depth);
                        }
                    }
                } // ---- end case C (block opener) ---=|
            }
            ix++;
            continue;
        } // ---- end of step F ---=|

        let nextLine = trimLine;
        let nextCloser: ">" | "/>" | null = null;

        /* check for closer at the end of the line; trim() */
        if (nextLine.endsWith("/>")) {
            nextCloser = "/>";
            nextLine = nextLine.slice(0, -2).trim();
        } else if (nextLine.endsWith(">")) {
            nextCloser = ">";
            nextLine = nextLine.slice(0, -1).trim();
        }

        /* process content, if any */
        if (nextLine) {
            if (is_Primitive(nextLine)) {
                const primitive = coerce(nextLine);
                const type = (is_not_string(primitive)) ? TokenΔ.VAL_CONTENTS : TokenΔ.STR_CONTENTS;
                finalTokens.push(CREATE_TOKEN({ type, content: [primitive] }));
            } else {
                /* use splitTopLevel to correctly handle items separated by commas, respecting quotes */
                const itemStrings = split_top_OLD(nextLine, ',');
                for (const str of itemStrings) {
                    const trimmedStr = str.trim();
                    if (trimmedStr) {
                        if (trimmedStr.startsWith('<')) {
                            /*  this item is a nested tag structure: recurse */
                            finalTokens.push(...tokenize_hson_OLD(trimmedStr, $depth + 1));
                        } else {
                            /* item is a primitive--use coerce() to get its actual value */
                            const prim = coerce(trimmedStr);
                            const type = (is_not_string(prim)) ? TokenΔ.VAL_CONTENTS : TokenΔ.STR_CONTENTS;
                            finalTokens.push(CREATE_TOKEN({ type, content: [prim] }));
                        }
                    }
                }
            }
        }

        /* if closer was found, process it */
        if (nextCloser) {
            if (contextStack.length === 0) {
                _throw_transform_err(`[token_from_hson] found closer '${nextCloser}' on line but context stack is empty`, 'tokenize-hson', currentLine);

            } else {
                const topStack = contextStack.pop() as Extract<ContextStackItem, { type: 'TAG' }>;

                /* two-stage pop for an implicit content VSN */
                if (topStack.isImplicitContent) {
                    /* close cluster */
                    const VSNToken = topStack.tag === ELEM_TAG ? TokenΔ.ELEM_CLOSE : TokenΔ.OBJ_CLOSE;
                    finalTokens.push(CREATE_TOKEN({ type: VSNToken, tag: topStack.tag }));

                    /*  parent tag is ALSO closed by this same character */
                    const parentContext = contextStack.pop() as Extract<ContextStackItem, { type: 'TAG' }>;
                    if (parentContext) {
                        finalTokens.push(CREATE_TOKEN({ type: TokenΔ.CLOSE, tag: parentContext.tag }));
                    } else {
                        _throw_transform_err(`[token_from_hson] found closer but no parent on stack`, 'tokenize_hson', currentLine);;
                    }
                } else {
                    /* normal tag closing. */
                    finalTokens.push(CREATE_TOKEN({ type: TokenΔ.CLOSE, tag: topStack.tag }));
                }
            }
        }

        ix++;
        continue;
    } // ---- end while loop ---=|

    $log(`[end of token from hson depth=${$depth}]\n    ---> processed all lines\n  final contextStack size (should be 0): ${contextStack.length}\n  total tokens generated: ${finalTokens.length}`);
    if (contextStack.length > 0 && $depth === 0) {
        const open_tags = contextStack.map(c => c.type === 'TAG' ? `<${c.tag}>` : '< < (implicit object)').join(', ');
        _throw_transform_err(`FINAL CHECK FAILED: tokenizer finished with ${contextStack.length} unclosed elements: ${open_tags}`, 'tokenize_hson');
    }

    $log(`[token_from_hson END depth=${$depth}] returning tokens: ${make_string(finalTokens)})`);

    /*  this logic should only apply to the top-level call, not recursive calls. */
    if ($depth === 0) {
        const is_empty = finalTokens.length === 0;
        const opens_root = !is_empty && finalTokens[0].type === TokenΔ.OPEN && finalTokens[0].tag === ROOT_TAG;
        const closes_root = !is_empty && finalTokens[finalTokens.length - 1].type === TokenΔ.CLOSE && finalTokens[finalTokens.length - 1].tag === ROOT_TAG;

        /*  the stack must be balanced for the content *within* any existing _root. */

        if (!(opens_root && closes_root) && contextStack.length === 0) {
            /* if not already appended to _root document (or it's empty): wrap */
            $log(`[token_from_hson END depth=0] Input was a fragment or not rooted with ROOT_TAG`);

            const root_open_token = CREATE_TOKEN({ type: TokenΔ.OPEN, tag: ROOT_TAG /* your ROOT_TAG */, attrs: {}, flags: [] });
            const root_close_token = CREATE_TOKEN({ type: TokenΔ.CLOSE, tag: ROOT_TAG /* your ROOT_TAG */, attrs: {}, flags: [] });

            finalTokens.unshift(root_open_token); /* add OPEN(_root) to the front */
            finalTokens.push(root_close_token);   /* add CLOSE(_root) to the end */
        }
    }

    if (_VERBOSE) {
        console.groupCollapsed('returning tokens:')
        console.log(finalTokens);
        console.groupEnd();
    }
    return finalTokens;

}
