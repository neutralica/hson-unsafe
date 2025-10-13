// parse-tokens.transform.hson.ts

import { Primitive, HsonNode, is_Node_NEW } from "../..";
import { STR_TAG, VAL_TAG, ARR_TAG, OBJ_TAG, ELEM_TAG, ROOT_TAG, II_TAG } from "../../types-consts/constants";
import { TOKEN_KIND, CLOSE_KIND, CREATE_NODE } from "../../types-consts/factories";
import { _DATA_INDEX } from "../../types-consts/constants";
import { NodeContent } from "../../types-consts/node.new.types";
import { Tokens, CloseKind, TokenOpen, TokenEnd, TokenArrayOpen, TokenArrayClose, TokenKind, TokenText } from "../../types-consts/tokens.new.types";
import { coerce } from "../../utils/coerce-string.utils";
import { make_string } from "../../utils/make-string.utils";
import { is_string_NEW } from "../../utils/node-guards.new.utils";
import { _snip } from "../../utils/snip.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
import { split_attrs_meta } from "./hson-helpers/split-attrs-meta.new.utils";
import { unwrap_root_obj } from "../../utils/unwrap-obj.util";


/* debug log */
const _VERBOSE = true;
const boundLog = console.log.bind(console, '%c[hson token-Nodifier]', 'color: darkgreen; background: lightblue;');
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
export function parse_tokens($tokens: Tokens[]): HsonNode {
    const nodes: HsonNode[] = [];
    const topCloseKinds: CloseKind[] = [];

    let ix = 0;
    const N = $tokens.length;
    function _peek(): Tokens | undefined { return $tokens[ix]; }
    function _take(kind: typeof TOKEN_KIND.OPEN): TokenOpen;
    function _take(kind: typeof TOKEN_KIND.CLOSE): TokenEnd;
    function _take(kind: typeof TOKEN_KIND.ARR_OPEN): TokenArrayOpen;
    function _take(kind: typeof TOKEN_KIND.ARR_CLOSE): TokenArrayClose;
    function _take(): Tokens | null;

    // CHANGED: runtime impl checks when an expected kind is passed
    function _take(expected?: TokenKind): any {
        const tok = $tokens[ix++] as Tokens | undefined;
        if (!tok) return null;
        if (expected && tok.kind !== expected) {
            _throw_transform_err(`expected ${expected}, got ${tok.kind}`, 'parse_tokens_NEW');
        }
        return tok;
    }

    // (Optional) keep a type guard too; it’s fine and helps in places without overloads
    function isTokenOpen(t: Tokens | null | undefined): t is TokenOpen {
        return !!t && t.kind === TOKEN_KIND.OPEN;
    }
    function readTag($isTopLevel = false): { node: HsonNode; closeKind: CloseKind } {
        // NOTE: _take() returning any is sketchy; narrow immediately.
        const tok = _take();
        if (!isTokenOpen(tok)) {
            _throw_transform_err(`expected OPEN, got ${tok?.kind ?? 'eof'}`, 'parse_tokens_new');
        }
        const open = tok as TokenOpen;

        const { attrs, meta } = split_attrs_meta(open.rawAttrs);
        const node: HsonNode = { _tag: open.tag, _meta: meta, _content: [] };

        // VSNs carry no _attrs
        const isVSN =
            open.tag === STR_TAG || open.tag === VAL_TAG ||
            open.tag === ARR_TAG || open.tag === OBJ_TAG ||
            open.tag === ELEM_TAG || open.tag === ROOT_TAG ||
            open.tag === II_TAG;

        if (!isVSN && Object.keys(attrs).length) {
            node._attrs = attrs;
        }

        let sawClose: TokenEnd | null = null;
        const kids: HsonNode[] = [];
        let sawEmptyObjShorthand = false; // <-- NEW

        // --- gather children
        while (ix < N) {
            const t = _peek(); if (!t) break;

            if (t.kind === TOKEN_KIND.EMPTY_OBJ) {
                _take();
                sawEmptyObjShorthand = true;      // <-- NEW: remember "<>"
                continue;
            }
            if (t.kind === TOKEN_KIND.CLOSE) { sawClose = _take() as TokenEnd; break; }

            if (t.kind === TOKEN_KIND.TEXT) {
                const tt = _take() as TokenText;
                const prim = tt.quoted ? tt.raw : coerce(tt.raw);
                kids.push(make_leaf(prim));
                continue;
            }

            if (t.kind === TOKEN_KIND.ARR_OPEN) { kids.push(readArray()); continue; }
            if (t.kind === TOKEN_KIND.OPEN) { kids.push(readTag(false).node); continue; }

            _throw_transform_err(`unexpected token ${t.kind} inside <${open.tag}>`, 'parse_tokens_NEW');
        }

        if (!sawClose) _throw_transform_err(`missing CLOSE for <${open.tag}>`, 'parse_tokens_NEW');
        const closeKind = sawClose.close;

        // ---------- <_root>: choose cluster by its own closer; never mix modes ----------
        if (open.tag === ROOT_TAG) {
            // NEW: explicit "<>" under root => single empty _obj cluster
            if (sawEmptyObjShorthand) {
                node._content = [{ _tag: OBJ_TAG, _meta: {}, _content: [] }];
                if ($isTopLevel) topCloseKinds.push(closeKind);
                return { node, closeKind };
            }

            if (kids.length === 1 && kids[0]._tag === ARR_TAG) {
                node._content = kids as NodeContent; // passthrough array cluster
            } else if (kids.length > 0) {
                const clusterTag = (closeKind === CLOSE_KIND.elem) ? ELEM_TAG : OBJ_TAG;
                node._content = [{ _tag: clusterTag, _meta: {}, _content: kids as NodeContent }];
            } else {
                node._content = [];
            }
            if ($isTopLevel) topCloseKinds.push(closeKind);
            return { node, closeKind };
        }

        // ---------- VSN passthroughs (unchanged) ----------
        if (open.tag === OBJ_TAG || open.tag === ARR_TAG || open.tag === ELEM_TAG) {
            node._content = kids as NodeContent;
            if ($isTopLevel) topCloseKinds.push(closeKind);
            return { node, closeKind };
        }

        if (open.tag === STR_TAG || open.tag === VAL_TAG || open.tag === II_TAG) {
            node._content = kids as NodeContent;
            if ($isTopLevel) topCloseKinds.push(closeKind);
            return { node, closeKind };
        }

        // ---------- Normal tag: SINGLE-MODE shaping (no _elem/_obj mixing) ----------
        if (closeKind === CLOSE_KIND.obj) {
            // OBJECT semantics: ensure exactly one inner _obj OR pass through a single _arr/_obj
            if (kids.length === 1 && (kids[0]._tag === OBJ_TAG || kids[0]._tag === ARR_TAG)) {
                node._content = [kids[0]]; // passthrough a single cluster
            } else {
                node._content = [{
                    _tag: OBJ_TAG,
                    _meta: {},
                    _content: kids as NodeContent
                }];
            }

            // Guardrail: object mode must yield a single _obj/_arr
            const c = node._content as HsonNode[];
            if (!(c.length === 1 && (c[0]._tag === OBJ_TAG || c[0]._tag === ARR_TAG))) {
                _throw_transform_err("object semantics must yield a single _obj/_arr child", "parse_tokens.object");
            }
        } else {
            // ELEMENT semantics: ensure exactly one inner _elem (idempotent)
            if (kids.length === 1 && kids[0]._tag === ELEM_TAG) {
                node._content = kids as NodeContent; // already clustered
            } else {
                node._content = [{
                    _tag: ELEM_TAG,
                    _meta: {},
                    _content: kids as NodeContent
                }];
            }

            // Guardrail: element mode must yield a single _elem
            const c = node._content as HsonNode[];
            if (!(c.length === 1 && c[0]._tag === ELEM_TAG)) {
                _throw_transform_err("element semantics must yield a single _elem child", "parse_tokens.element");
            }
        }

        if ($isTopLevel) topCloseKinds.push(closeKind);
        return { node, closeKind };
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
            const t = _peek(); if (!t) break;
            if (t.kind === TOKEN_KIND.ARR_CLOSE) { _take(); break; }

            let childNode: HsonNode;

            if (t.kind === TOKEN_KIND.EMPTY_OBJ) {

                _take();
                // CHANGED: build an empty object *item*
                childNode = CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [] });
            } else if (t.kind === TOKEN_KIND.TEXT) {
                const tt = _take() as TokenText;
                const prim = tt.quoted ? tt.raw : coerce(tt.raw);
                childNode = make_leaf(prim);
            } else if (t.kind === TOKEN_KIND.OPEN) {
                childNode = readTag(false).node;
            } else if (t.kind === TOKEN_KIND.ARR_OPEN) {
                childNode = readArray();
            } else {
                _throw_transform_err(`unexpected ${t.kind} in array`, 'parse_tokens_new');
            }

            const passThruVSNs = new Set<string>([OBJ_TAG, ARR_TAG, ELEM_TAG, STR_TAG, VAL_TAG]);
            if (!passThruVSNs.has(childNode._tag)) {
                // standard tag → wrap in _obj to honor always-wrap in JSON-mode
                childNode = CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [childNode] });
            }
            childNode = unwrap_root_obj(childNode);
            items.push(({
                _tag: II_TAG,
                _meta: { [_DATA_INDEX]: String(idx) },
                _content: [childNode],
            }));
            idx++;
        }

        return CREATE_NODE({ _tag: ARR_TAG, _meta: {}, _content: items });
    }

    /* drive the stream */
    while (ix < N) {
        const t = _peek();
        if (!t) break;
        if (t.kind === TOKEN_KIND.OPEN) { nodes.push(readTag(true).node); continue; }
        if (t.kind === TOKEN_KIND.ARR_OPEN) { nodes.push(readArray()); continue; }
        if (t.kind === TOKEN_KIND.TEXT) {
            const tt = _take() as TokenText;
            const prim = tt.quoted ? tt.raw : coerce(tt.raw);
            nodes.push(
                make_leaf(prim)
            );
            continue;
        }
        _throw_transform_err(`unexpected top-level token ${t.kind}`, 'parse_tokens_new');
    }
    if (nodes.length === 1 && nodes[0]._tag === ROOT_TAG) {
        return nodes[0]; // <-- CHANGED
    }

    /* implicit-root fallback (no explicit <_root>) */
    {
        const kids = nodes;
        console.warn('kids');
        // if already a single cluster, keep as-is
        if (kids.length === 1 && (kids[0]._tag === OBJ_TAG || kids[0]._tag === ARR_TAG || kids[0]._tag === ELEM_TAG)) {
            return CREATE_NODE({
                _tag: ROOT_TAG, _meta: {},
                _content: [CREATE_NODE({ _tag: kids[0]._tag, _meta: {}, _content: kids[0]._content ?? [] })],
            });
        }

        // empty → empty object cluster
        if (kids.length === 0) {
            return CREATE_NODE({
                _tag: ROOT_TAG, _meta: {},
                _content: [CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [] })],
            });
        }

        // all non-VSN tags and unique → _obj, else _elem
        const allProps = kids.every(n => typeof n._tag === 'string' && !n._tag.startsWith('_'));
        const unique = allProps && (new Set(kids.map(n => n._tag))).size === kids.length;
        const clusterTag = unique ? OBJ_TAG : ELEM_TAG;
        return CREATE_NODE({
            _tag: ROOT_TAG, _meta: {},
            _content: [CREATE_NODE({ _tag: clusterTag, _meta: {}, _content: kids })],
        });
    }
}