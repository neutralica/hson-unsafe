// parse-tokens.transform.hson.ts

import { HsonNode, BasicValue } from "../../types-consts/base.types.hson.js";
import { NEW_NODE, ROOT_TAG, OBJECT_TAG, BLANK_META, TokenΔ, ARRAY_TAG, ELEM_TAG, INDEX_TAG, VSN_TAGS, PRIM_TAG, STRING_TAG } from "../../types-consts/base.const.hson.js";
import { AllTokens } from "../../types-consts/tokens.types.hson.js";
import { is_not_string, is_BasicValue } from "../../utils/is-helpers.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";

/* debug log */
const _VERBOSE = false;
const $log = _VERBOSE
    ? console.log
    : () => { };

/**
 * assembles a flat array of hson tokens into a hierarchical hsonnode tree.
 *
 * this function acts as the second stage of the hson parser, consuming the
 * output of the tokenizer. it uses a stack to build the nested structure of
 * the final data tree, correctly handling open, close, and self-closing tokens.
 *
 * @param {AllTokens[]} $tokens - an array of token objects produced by the `tokenize_hson` function.
 * @returns {HsonNode} the fully constructed, hierarchical root hsonnode.
 */

export function parse_tokens($tokens: AllTokens[]): HsonNode {
    const nodeStack: HsonNode[] = [];
    let finalNode: HsonNode | null = null;

    if (!$tokens || $tokens.length === 0) {
        console.error("token_to_node received no tokens");
        return NEW_NODE({ tag: ROOT_TAG, content: [NEW_NODE({ tag: OBJECT_TAG, content: [], _meta: BLANK_META })], _meta: BLANK_META });
    }
    if (_VERBOSE) {
        console.log('---> parsing tokens');
        console.groupCollapsed(' input tokens:');
        console.log($tokens);
        console.groupEnd();
    }
    for (let i = 0; i < $tokens.length; i++) {
        const token = $tokens[i];
        const parent = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : null;

        if (parent && !parent.content && token.type !== TokenΔ.OPEN && token.type !== TokenΔ.ARRAY_OPEN) {
            /* this check should be streamlined to just check for the opposite and error; content is always [] */
            if (parent.tag === OBJECT_TAG || parent.tag === ARRAY_TAG || parent.tag === ELEM_TAG) {
                parent.content = [];
            } else {
                /* this warning indicates a malformed VSN */
                console.warn(`node on stack (tag: ${parent.tag}) missing content array when trying to add children not via OPEN/ARRAY_OPEN.`);
            }
        }

        const currentToken = { ...token };
        const currentParent = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : null;
        switch (token.type) {
            case TokenΔ.OPEN: {
                /* for processing:
                    1. standard tags (<head>, <point>, <body>, <li>, <p>, <foo>)
                    2. explicit OBJECT_TAG VSNs (e.g., <_obj>)
                       (step F emits OPEN(parent) then OBJ_OPEN or ELEM_OPEN to capture structure 
                */


                const newNode = NEW_NODE({
                    tag: currentToken.tag!,
                    content: [],
                    _meta: { attrs: currentToken.attrs ?? {}, flags: currentToken.flags ?? [] }
                });

                if (currentParent) {
                    if (currentParent.tag === ARRAY_TAG) {
                        /* current token (nodeForOpenToken) is an item of an _array.
                            wrap in _ii, then if it's a standard tag, wrap contents in _obj. */
                        let iiContent = newNode;

                        /* check if it's a standard (non-VSN) tag */
                        if (
                            !VSN_TAGS.includes(newNode.tag)
                        ) {
                            /* standard tag (e.g. `<key` ) containing an item in an array */
                            $log(`[token_to_node OPEN for ARRAY item] <${newNode.tag}> is prop of new _obj`);
                            iiContent = NEW_NODE({
                                tag: OBJECT_TAG,
                                content: [newNode],
                            });
                            nodeStack.push(iiContent); /* push _obj, parent tag will be pushed after */
                        }

                        const index_node = NEW_NODE({
                            tag: INDEX_TAG, /* (_ii node) */
                            content: [iiContent],
                            _meta: { attrs: { "data-index": currentParent.content!.length.toString() }, flags: [] }
                        });
                        currentParent.content!.push(index_node);

                    } else if (currentParent.tag === ELEM_TAG || currentParent.tag === OBJECT_TAG) {
                        /* parent is _elem or _obj, contents are not wrapped */
                        $log(`[token_to_node OPEN] pushing <${newNode.tag}> to parent <${currentParent.tag}>`);
                        currentParent.content!.push(newNode);
                    } else {
                        /* parent is another standard tag (e.g. <head> is parent of <title>, <point> is parent of <keyA>)
                            This means newNode is a direct child/property of that standard tag.
                             The content of the parent standard tag will be finalized by its CLOSE handler
                             (which will wrap these children in _obj or _elem based on HSON closer syntax /> vs >). */
                        currentParent.content!.push(newNode);
                    }
                } else {  /* no parent, this is the root node */
                    finalNode = newNode;
                    $log(`[token_to_node OPEN] Established root node: <${newNode.tag}>`);
                }
                nodeStack.push(newNode);
                break;

            } // ---- end of TokenΔ.OPEN case ---=|

            case TokenΔ.OBJ_OPEN: {
                /* for processing JSON data */
                if (currentToken.tag !== OBJECT_TAG) {
                    console.error(`[token_to_node] OBJ_OPEN token with unexpected tag: ${currentToken.tag}`);
                    break;
                }

                const newObj = NEW_NODE({
                    tag: OBJECT_TAG, /* (_obj node) */
                    content: [],
                });

                if (currentParent) {
                    /* accommodate _array and _ii nodes */
                    if (currentParent.tag === ARRAY_TAG) {
                        const index = currentParent.content!.length;

                        /* create the index to maintain array sequence */
                        const dataIx = {
                            attrs: {
                                'data-index': String(index)
                            },
                            flags: []
                        };

                        const newIi = NEW_NODE({
                            tag: INDEX_TAG,
                            content: [newObj],
                            _meta: dataIx
                        });

                        currentParent.content!.push(newIi);

                    } else {
                        currentParent.content!.push(newObj);
                    }
                } else {
                    finalNode = newObj;

                }
                nodeStack.push(newObj);
                $log(`[token_to_node OBJ_OPEN] Opened <${newObj.tag}>. Stack top: ${newObj.tag}`);
                break;
            } // ---- end TokenΔ.OBJ_OPEN case ---=|

            /* handle _elem nodes (from html sources) */
            case TokenΔ.ELEM_OPEN: {
                if (currentToken.tag !== ELEM_TAG) {
                    console.error(`[token_to_node] ELEM_OPEN token with unexpected tag: ${currentToken.tag} (should be '_elem')`);
                    break;
                }

                const elemNode = NEW_NODE({
                    tag: ELEM_TAG,
                    content: [],
                });

                if (currentParent) {
                    currentParent.content!.push(elemNode);
                } else { finalNode = elemNode; }
                nodeStack.push(elemNode);
                $log(`[token_to_node LIST_OPEN] opened <${elemNode.tag}>; stack top: ${elemNode.tag}`);
                break;
            }

            case TokenΔ.ARRAY_OPEN: {
                if (currentToken.tag !== ARRAY_TAG) {
                    console.error(`[token_to_node] ARRAY_OPEN token with unexpected tag: ${currentToken.tag}`);
                    break;
                }

                const arrayNode = NEW_NODE({
                    tag: ARRAY_TAG,
                    content: [],
                });

                if (currentParent) {
                    if (currentParent.tag === ARRAY_TAG) { /* nested _array as an _array item */
                        const newIi = NEW_NODE({ tag: INDEX_TAG, content: [arrayNode], _meta: { attrs: { "data-index": currentParent.content!.length.toString() }, flags: [] } });
                        currentParent.content!.push(newIi);
                    } else if (currentParent.tag === ELEM_TAG) { /* v unlikely to occur */
                        console.warn('curious--I don`t think we should be reaching this?');
                        currentParent.content!.push(arrayNode);
                    } else { /* _obj or standardTag */
                        currentParent.content!.push(arrayNode);
                    }
                } else {
                    finalNode = arrayNode;

                }
                nodeStack.push(arrayNode);
                $log(`[token_to_node ARRAY_OPEN] opened <${arrayNode.tag}>\n stack top: ${arrayNode.tag}`);
                break;
            }

            case TokenΔ.OBJ_CLOSE: {
                const closingTag = token.tag; /* this should be `_obj` */

                if (nodeStack.length === 0) {
                    throw new Error(`[token_to_node OBJ_CLOSE] mismatched CLOSE token </${closingTag}> (expected VSN type ${OBJECT_TAG})\n node stack is empty`);
                }

                const closingNode = nodeStack[nodeStack.length - 1];

                if (closingTag !== OBJECT_TAG) { /* Token's tag itself should also be _obj */
                    console.error(`[token_to_node OBJ_CLOSE] token tag is <${closingTag}> but expected ${OBJECT_TAG}\n closing ${closingNode.tag} based on stack`);
                }

                const poppedNode = nodeStack.pop()!;
                $log(`[token_to_node OBJ_CLOSE] closing: ${poppedNode.tag}>`);

                if (nodeStack.length === 0) {
                    finalNode = poppedNode;
                    $log(`[token_to_node OBJ_CLOSE] setting final node: "${finalNode?.tag}"`);
                }
                break;
            } // ---- end OBJ_CLOSE case ---=|

            case TokenΔ.CLOSE:
            case TokenΔ.ARRAY_CLOSE:
            case TokenΔ.ELEM_CLOSE: {
                const close_tag = token.tag;

                /* 1. validate */
                if (nodeStack.length === 0) {
                    throw new Error(`Mismatched CLOSE token </${close_tag}>. Node stack empty.`);
                }
                const closingNode = nodeStack.pop();
                if (!closingNode) throw new Error('could not pop nodestack');
                if (closingNode.tag !== close_tag) {
                    throw new Error(`mismatched CLOSE token: expected </${closingNode.tag}> but got </${close_tag}>`);
                }

                /* pop stack, get collect children directly into content */
                const children: HsonNode[] = Array.isArray(closingNode.content)
                    ? closingNode.content as HsonNode[]
                    : [];


                /* branch based on the type of tag being closed */
                if (!VSN_TAGS.includes(closingNode.tag.toLowerCase())) {
                    if (children.length === 0) {
                        /* case 1 -- tag was empty */
                        closingNode.content = [];
                        $log(`[token_to_node CLOSE] standard tag <${closingNode.tag}> is empty`);
                    } else if ( /* tag contains a VSN */
                        children.length === 1 && VSN_TAGS.includes(children[0].tag
                        )) {
                        $log(`[token_to_node CLOSE] standard tag <${closingNode.tag}> content is single VSN <${children[0].tag}> `);
                        closingNode.content = [children[0]];
                    } else {
                        $log(`[token_to_node CLOSE] standard tag ${closingNode.tag}> content was not a recognized VSN; defaulting to _obj.`);
                        const objVSN = NEW_NODE({
                            tag: OBJECT_TAG,
                            content: children,
                        });
                        closingNode.content = [objVSN];
                    }
                }

                /* 5. add the finalized node to its parent */
                if (nodeStack.length === 0) {
                    $log(`[token_to_node CLOSE] completed node: "${closingNode.tag}"`);
                    finalNode = closingNode;
                }
                break;
            } // ---- end case CLOSE / LIST_OR_ARRAY_CLOSE ---=|

            case (TokenΔ.SELF): {
                $log(`[token_to_node SELF] processing SELF token: <${token.tag}>`);

                /*  determine the content VSN based on token.content */
                let selfVSN: HsonNode[] | undefined = undefined;
                let primValue: BasicValue | undefined = undefined;
                let has_content = false;
                if (parent?.tag !== ELEM_TAG && parent?.tag !== OBJECT_TAG) {
                    console.error(' [error in parse-tokens!!] parent.tag is not _elem or _obj: should be VSN', parent?.tag)
                }

                /* null check if token.content exists and analyze */
                if (token.content !== undefined) {
                    if (Array.isArray(token.content)) {
                        /* exactly one primitive element for SELF tag content */
                        if (token.content.length === 1 && is_BasicValue(token.content[0])) {
                            primValue = token.content[0];
                            has_content = true;
                        } else if (token.content.length === 0) {
                            /* empty -> No primitive content (e.g. void elements) */
                            has_content = false;
                        } else {
                            console.warn(`[token_to_node SELF] SELF token <${token.tag}> has unexpected array content length/type: ${JSON.stringify(token.content)}`);
                            has_content = false;
                        }
                    } else {
                        /* token content, like node content, is always an array. if we've reached 
                            this point there's something wrong but we'll try to limp along. */
                        console.warn('probbaly should not be here (token.content is not in array)')
                        if (typeof token.content !== 'object') {
                            console.warn('I think we found a primitive?')
                            primValue = token.content;
                            has_content = true;
                        } else { /* should not happen based on SELF token structure, but handle defensively */
                            console.warn(`[token_to_node SELF] SELF token <${token.tag}> has unexpected non-array object content: ${JSON.stringify(token.content)}. Treating as no primitive content.`);
                            has_content = false;
                        }
                    }
                }

                /* create VSN */
                if (has_content && primValue !== undefined) {
                    /* if valid primitive content -> create #text VSN */
                    const tag = (is_not_string(primValue)) ? PRIM_TAG : STRING_TAG;
                    selfVSN = [NEW_NODE({
                        tag,
                        content: [primValue], /* (all content is always in an array) */
                    })];
                }
                const VsnWrapper = selfVSN ? [NEW_NODE({
                    tag: parent?.tag,
                    content: [...selfVSN]
                })] : []

                /*  2. create node for the SELF tag */
                const selfNode = NEW_NODE({
                    tag: token.tag,
                    content: VsnWrapper, /*  [] if no content */
                    _meta: {
                        attrs: currentToken.attrs || {},
                        flags: currentToken.flags || []
                    }
                });
                if (currentParent) {
                    let childNode = selfNode;
                    if (currentParent.tag === ARRAY_TAG) {
                        $log(`[token_to_node SELF] parent is √ array; wrapping <${selfNode.tag}> in <_ii>`);
                        childNode = NEW_NODE({
                            tag: INDEX_TAG,
                            content: [selfNode],
                            _meta: { attrs: { "data-index": currentParent.content.length.toString() }, flags: [] }
                        });
                    }
                    currentParent.content.push(childNode);
                    $log(`[token_to_node SELF] Added node "${childNode.tag}"\nwrapping SELF <${selfNode.tag}>) to parent "${currentParent.tag}"`);

                } else {
                    /*  (_root handling or error for SELF without parent) */
                    if (finalNode === null && token.tag === ROOT_TAG) {

                        finalNode = selfNode;
                    } else {
                        console.error(`[token_to_node SELF] <${token.tag}> has no parent on stack and is not root.`);
                    }
                }
                break;  /* do not push onto nodeStack */
            }

            case TokenΔ.PRIM_VAL:
            case TokenΔ.STR_VAL: {
                /* handle nodes containing BasicValues (primitives) */
                $log('[token_to_node #TEXT] processing token:', JSON.stringify(token));
                if (!parent) {
                    throw new Error(`HASHTAG_TEXT token encountered with no parent node on stack. Token: ${JSON.stringify(token)}`);
                }
                if (token.content != undefined && token.content.length > 1) {
                    console.error('hashtag content length longer than 1')
                }
                let primitiveValue: BasicValue | undefined = undefined;

                if (Array.isArray(token.content)) {
                    if (token.content.length === 1 && is_BasicValue(token.content[0])) {
                        /* it's an array with content length 1 */
                        $log(token + '.content.length === 1');

                        primitiveValue = token.content[0];
                    } else if (token.content.length === 0) {
                        /* it's an empty array, e.g., content: [] from an empty text node. */
                        $log(token + '.content.length === 0');
                        primitiveValue = "";

                    } else {
                        $log(token + '.content.length === 2+');
                        console.error(`[token_to_node HASHTAG_TEXT] content is an array but not a single primitive: ${JSON.stringify(token.content)}. Skipping.`);
                    }
                } else if (is_BasicValue(token.content)) {
                    /* should not get here but what if */
                    console.error(' token.content is primitive (WARNING! should not be here);')
                    primitiveValue = token.content;
                } else {
                    /* token.content is undefined or some other unexpected type */
                    console.error(`[token_to_node HASHTAG_TEXT] content is undefined or not a primitive/array: ${JSON.stringify(token.content)}. Skipping.`);
                }

                if (primitiveValue !== undefined) {
                    /* create value node (_text or _prim VSN) */
                    const tag = (is_not_string(primitiveValue)) ? PRIM_TAG : STRING_TAG
                    const content_node = NEW_NODE({ tag, content: [primitiveValue] }); /* node.content is array! */
                    const currentParent = nodeStack[nodeStack.length - 1];
                    let finalNode = content_node;

                    if (currentParent.tag === ARRAY_TAG) {
                        finalNode = NEW_NODE({
                            tag: INDEX_TAG, content: [content_node], _meta: {
                                attrs: { "data-index": currentParent.content.length.toString() }, flags: []
                            }
                        });
                    } else {
                        finalNode = content_node;
                    }
                    $log('pushing ', finalNode, ' to ', currentParent);
                    currentParent.content.push(finalNode);
                }
                break;
            }
            default: {
                throw new Error(`Unknown token type: ${(token as any)?.type} encountered near token index ${i}`);
            }
        }
    }

    if (nodeStack.length !== 0) {
        console.error("final stack should be empty!\n", make_string(nodeStack.map(n => n.tag)));
        throw new Error(`unbalanced OPEN/CLOSE tokens: ${nodeStack.length} nodes left on stack.`);
    }

    if (!finalNode) {
        if ($tokens.length > 0) {
            /* if there were tokens but no root, something has gone wrong */
            console.error("parsing finished but no root node was completed, despite tokens being present");
            throw new Error("parsing finished but no root node was completed");
        }
        /* if tokens array was empty and we didn't hit the initial check (should not happen), make a default empty root */
        console.warn("no tokens processed and no root node completed. Creating default empty root.");
        return NEW_NODE({ tag: ROOT_TAG, content: [NEW_NODE({ tag: OBJECT_TAG, content: [], _meta: BLANK_META })], _meta: BLANK_META });
    }

    $log(`[token_to_node END] final check: completedRootNode is ${finalNode ? `set (tag: ${finalNode.tag})` : 'null/undefined'}\n nodeStack size: ${nodeStack.length}`);

    /* final check and return */
    /*  check if root node exists *if* there were tokens to process */
    if (!finalNode && $tokens.length > 0) {
        console.error("parsing finished but no root node was completed");
        throw new Error("Parsing finished but no root node was completed.");
    } else if (!finalNode && $tokens.length === 0) {
        /*  handle empty input - error or empty root node? */
        console.warn("input token array was empty. Returning empty root");
    }
    if (_VERBOSE){
        console.groupCollapsed('returning node:')
        console.log(make_string(finalNode));
        console.groupEnd();
    }
    return finalNode;
}