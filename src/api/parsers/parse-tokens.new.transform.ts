// parse-tokens.transform.hson.ts

import { Primitive,  HsonNode, is_Node_NEW } from "../..";
import { STR_TAG, VAL_TAG, ARR_TAG, OBJ_TAG, ELEM_TAG, ROOT_TAG, II_TAG } from "../../types-consts/constants";
import { TOKEN_KIND, CLOSE_KIND } from "../../types-consts/factories";
import { _DATA_INDEX } from "../../types-consts/constants";
import { NodeContent } from "../../types-consts/node.new.types";
import { Tokens_NEW, CloseKind, TokenOpen_NEW, TokenEnd_NEW, TokenArrayOpen_NEW, TokenArrayClose_NEW, TokenKind, TokenText_NEW } from "../../types-consts/tokens.new.types";
import { coerce } from "../../utils/coerce-string.utils";
import { make_string } from "../../utils/make-string.utils";
import { is_string_NEW } from "../../utils/node-guards.new.utils";
import { _snip } from "../../utils/snip.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
import { split_attrs_meta } from "./hson-helpers/split-attrs-meta.new.utils";


/* debug log */
const _VERBOSE = false;
const boundLog = console.log.bind(console, '%c[hson]', 'color: green; background: lightblue;');
const _log = _VERBOSE ? boundLog : () => { };

const make_leaf = (v: Primitive): HsonNode =>
(is_string_NEW(v)
    ? { _tag: STR_TAG, _meta: {}, _content: [v] }
    : { _tag: VAL_TAG, _meta: {}, _content: [v] });


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

/* top-level token stream → HsonNode_NEW
   this wraps multiple top-level nodes in a _root with elem semantics
*/
export function parse_tokens_NEW($tokens: Tokens_NEW[]): HsonNode {
    _log('parsing tokens: ', _snip(make_string($tokens)));
    const nodes: HsonNode[] = [];
    const topCloseKinds: CloseKind[] = [];

    let ix = 0;
    const N = $tokens.length;
    function _peek(): Tokens_NEW | undefined { return $tokens[ix]; }
    function _take(kind: typeof TOKEN_KIND.OPEN): TokenOpen_NEW;
    function _take(kind: typeof TOKEN_KIND.CLOSE): TokenEnd_NEW;
    function _take(kind: typeof TOKEN_KIND.ARR_OPEN): TokenArrayOpen_NEW;
    function _take(kind: typeof TOKEN_KIND.ARR_CLOSE): TokenArrayClose_NEW;
    function _take(): Tokens_NEW | null;

    // CHANGED: runtime impl checks when an expected kind is passed
    function _take(expected?: TokenKind): any {
        const tok = $tokens[ix++] as Tokens_NEW | undefined;
        if (!tok) return null;
        if (expected && tok.kind !== expected) {
            _throw_transform_err(`expected ${expected}, got ${tok.kind}`, 'parse_tokens_NEW');
        }
        return tok;
    }

    // (Optional) keep a type guard too; it’s fine and helps in places without overloads
    function isTokenOpen(t: Tokens_NEW | null | undefined): t is TokenOpen_NEW {
        return !!t && t.kind === TOKEN_KIND.OPEN;
    }
    /* parse a tag starting at TAG_OPEN */
    function readTag($isTopLevel = false): { node: HsonNode; closeKind: CloseKind } {
        const t = _take();
        if (!isTokenOpen(t)) {
            _throw_transform_err(`expected OPEN, got ${t?.kind ?? 'eof'}`, 'parse_tokens_new');
        }
        const open = t;
        if (!open || open.kind !== TOKEN_KIND.OPEN) {
            _throw_transform_err(`expected OPEN, got ${open?.kind ?? 'eof'}`, 'parse_tokens_new');
        }
        const { attrs, meta } = split_attrs_meta(open.rawAttrs);
        const node: HsonNode = { _tag: open.tag, _meta: meta, _content: [] };

        // VSNs carry no _attrs
        const isVSN = open.tag === STR_TAG || open.tag === VAL_TAG
            || open.tag === ARR_TAG || open.tag === OBJ_TAG
            || open.tag === ELEM_TAG || open.tag === ROOT_TAG
            || open.tag === II_TAG;

        if (!isVSN && Object.keys(attrs).length) {
            node._attrs = attrs;
        }
        let sawClose: TokenEnd_NEW | null = null;
        const kids: HsonNode[] = []; // CHANGED: keep only nodes, not primitives

        while (ix < N) {
            const t = _peek(); if (!t) break;

            if (t.kind === TOKEN_KIND.CLOSE) { sawClose = _take() as TokenEnd_NEW; break; }

            if (t.kind === TOKEN_KIND.TEXT) {
                const tt = _take() as TokenText_NEW;
                const prim = tt.quoted ? tt.raw : coerce(tt.raw);
                kids.push(make_leaf(prim));                  // CHANGED: push _str/_val leaf
                continue;
            }

            if (t.kind === TOKEN_KIND.ARR_OPEN) { kids.push(readArray()); continue; }
            if (t.kind === TOKEN_KIND.OPEN) { kids.push(readTag(false).node); continue; }

            _throw_transform_err(`unexpected token ${t.kind} inside <${open.tag}>`, 'parse_tokens_NEW');
        }

        if (!sawClose) _throw_transform_err(`missing CLOSE for <${open.tag}>`, 'parse_tokens_NEW');

        const hasKids = kids.length > 0;

        if (open.tag === ROOT_TAG) {
            const single_array_child =
                kids.length === 1 && (kids[0] as HsonNode)._tag === ARR_TAG;

            if (single_array_child) {
                /* keep _array as the direct child of _root */
                node._content = kids as NodeContent;
            } else if (hasKids) {
                /* fall back to the normal wrapper based on the closer */
                node._content = [{
                    _tag: (sawClose.close === CLOSE_KIND.elem) ? ELEM_TAG : OBJ_TAG,
                    _meta: {},
                    _content: kids as NodeContent,
                }];
            } else {
                /* empty root */
                node._content = [];
            }

            /* return from whatever wrapper helper you’re in if needed */
        } else {
            /* normal tags: same logic as before, but elide empty _elem */
            if (sawClose.close === CLOSE_KIND.elem) {
                node._content = hasKids
                    ? [{
                        _tag: ELEM_TAG,
                        _meta: {},
                        _content: kids as NodeContent,
                    }]
                    : []; /* CHANGED: no empty _elem wrapper */
            } else {
                /* object block: keep _obj even if empty */
                node._content = [{
                    _tag: OBJ_TAG,
                    _meta: {},
                    _content: kids as NodeContent,
                }];
            }
        }

        if ($isTopLevel) topCloseKinds.push(sawClose.close);
        return { node, closeKind: sawClose.close };
    }

    /* parse an array starting at ARRAY_OPEN */


    function readArray(): HsonNode {
        const arrOpen = _take();
        if (!arrOpen || arrOpen.kind !== TOKEN_KIND.ARR_OPEN) {
            _throw_transform_err(`expected ARR_OPEN, got ${arrOpen?.kind ?? 'eof'}`, 'parse_tokens_new');
        }
        const items: HsonNode[] = [];
        let idx = 0;

        while (ix < N) {
            const t = _peek();
            if (!t) break;

            if (t.kind === TOKEN_KIND.ARR_CLOSE) { _take(); break; }
            let childNode: HsonNode;

            if (t.kind === TOKEN_KIND.TEXT) {
                const tt = _take() as TokenText_NEW;
                const prim = tt.quoted ? tt.raw : coerce(tt.raw);
                childNode = make_leaf(prim);
            } else if (t.kind === TOKEN_KIND.OPEN) {
                childNode = readTag(false).node;
            } else if (t.kind === TOKEN_KIND.ARR_OPEN) {
                childNode = readArray();
            } else {
                _throw_transform_err(`unexpected ${t.kind} in array`, 'parse_tokens_new');
            }

            items.push({
                _tag: II_TAG,
                _meta: { [_DATA_INDEX]: String(idx) },
                _content: [childNode]
            });
            idx++;
        }

        return { _tag: ARR_TAG, _meta: {}, _content: items };
    }
  
    function chooseRootCluster($nodes: HsonNode[], $kinds: CloseKind[]): typeof OBJ_TAG | typeof ELEM_TAG {
        /* if any non-tag leaf (TEXT→_str/_val or _array) at top, prefer element semantics */
        const hasLeaf = $nodes.some(n => n._tag === STR_TAG || n._tag === VAL_TAG || n._tag === ARR_TAG);
        if (hasLeaf) return ELEM_TAG;

        /* if all observed top-level closers were 'obj' and tags are unique, use _obj */
        const allObj = $kinds.length > 0 && $kinds.every(k => k === CLOSE_KIND.obj);
        if (allObj) {
            const tags = $nodes.map(n => n._tag);
            const unique = new Set(tags);
            if (unique.size === tags.length) return OBJ_TAG;
        }

        /* default: _elem (duplicates allowed, order preserved) */
        return ELEM_TAG;
    }

    /* drive the stream */
    while (ix < N) {
        const t = _peek();
        if (!t) break;

        if (t.kind === TOKEN_KIND.OPEN) { nodes.push(readTag(true).node); continue; }
        if (t.kind === TOKEN_KIND.ARR_OPEN) { nodes.push(readArray()); continue; }
        if (t.kind === TOKEN_KIND.TEXT) {
            const tt = _take() as TokenText_NEW;
            const prim = tt.quoted ? tt.raw : coerce(tt.raw);
            nodes.push(
                typeof prim === 'string'
                    ? { _tag: STR_TAG, _meta: {}, _content: [prim] }
                    : { _tag: VAL_TAG, _meta: {}, _content: [prim] }
            );
            continue;
        }
        _throw_transform_err(`unexpected top-level token ${t.kind}`, 'parse_tokens_new');
    }
    if (nodes.length === 1 && nodes[0]._tag === ROOT_TAG) {
        const root = nodes[0];
        const kids = (root._content ?? []).filter(is_Node_NEW);


        if (kids.length === 1 && (kids[0]._tag === OBJ_TAG || kids[0]._tag === ARR_TAG || kids[0]._tag === ELEM_TAG)) {
            return root; 
        }

        // Decide cluster: prefer the recorded closer for <_root …> if you captured it,
        // else fall back to choose_root_cluster(kids, topCloseKinds).
        const rootCloser: CloseKind | null = topCloseKinds.length
            ? topCloseKinds[topCloseKinds.length - 1]   // or topCloseKinds.at(-1) if your target supports it
            : null;

        const clusterTag =
            rootCloser
                ? (rootCloser === CLOSE_KIND.obj ? OBJ_TAG : ELEM_TAG)
                : chooseRootCluster(kids, topCloseKinds);
        // Wrap (even if kids is empty):
        root._content = [{ _tag: clusterTag, _meta: {}, _content: kids }];
        // Make sure you did NOT leave stray non-cluster nodes at root level.
        return root;
    }

    /* root wrapper here, not in tokenizer */
    const clusterTag = chooseRootCluster(nodes, topCloseKinds);
    const root: HsonNode = {
        _tag: ROOT_TAG,
        _meta: {},
        _content: [{ _tag: clusterTag, _meta: {}, _content: nodes }],
    };

    _log('returning: ', root);

    return root;
}
