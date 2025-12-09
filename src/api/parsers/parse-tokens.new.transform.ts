// parse-tokens.transform.hson.ts

import { STR_TAG, VAL_TAG, ARR_TAG, OBJ_TAG, ELEM_TAG, ROOT_TAG, II_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { TOKEN_KIND, CLOSE_KIND, TokenEmptyObj } from "../../types-consts/token.types";
import { _DATA_INDEX } from "../../types-consts/constants";
import { HsonNode, NodeContent } from "../../types-consts/node.types";
import { Tokens, CloseKind, TokenOpen, TokenClose, TokenArrayOpen, TokenArrayClose, TokenKind, TokenText } from "../../types-consts/token.types";
import { coerce } from "../../utils/primitive-utils/coerce-string.utils";
import { _snip } from "../../utils/sys-utils/snip.utils";
import { unwrap_root_obj } from "../../utils/json-utils/unwrap-root-obj.util";
import { Primitive } from "../../types-consts";
import { split_attrs_meta } from "../../utils/hson-utils/split-attrs-meta.new.utils";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { is_string } from "../../core/utils/guards.core.utils";


/* debug log */

export const make_leaf = (v: Primitive): HsonNode =>
(is_string(v)
    ? CREATE_NODE({ _tag: STR_TAG, _meta: {}, _content: [v] })
    : CREATE_NODE({ _tag: VAL_TAG, _meta: {}, _content: [v] }));




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

export function parse_tokens($tokens: Tokens[]): HsonNode {
    const nodes: HsonNode[] = [];
    const topCloseKinds: CloseKind[] = [];

    let ix = 0;
    const N = $tokens.length;
    function _peek(): Tokens | undefined { return $tokens[ix]; }
    function _take(kind: typeof TOKEN_KIND.OPEN): TokenOpen;
    function _take(kind: typeof TOKEN_KIND.CLOSE): TokenClose;
    function _take(kind: typeof TOKEN_KIND.ARR_OPEN): TokenArrayOpen;
    function _take(kind: typeof TOKEN_KIND.ARR_CLOSE): TokenArrayClose;
    function _take(kind: typeof TOKEN_KIND.TEXT): TokenText;
    function _take(kind: typeof TOKEN_KIND.EMPTY_OBJ): TokenEmptyObj;
    function _take(): Tokens | null;

    // runtime impl checks when an expected kind is passed
    function _take(expected?: TokenKind): any {
        const tok = $tokens[ix++] as Tokens | undefined;
        if (!tok) return null;
        if (expected && tok.kind !== expected) {
            _throw_transform_err(`expected ${expected}, got ${tok.kind}`, 'parse_tokens');
        }
        return tok;
    }
    function decode_json_string_literal(inner: string): string {
        inner = inner.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
            try { return String.fromCharCode(parseInt(hex, 16)); }
            catch { return '\\u' + hex; } // keep as-is on failure
        });

        // Common escapes
        inner = inner.replace(/\\([nrtbf\\"'/\\])/g, (_, c) => {
            switch (c) {
                case 'n': return '\n';
                case 'r': return '\r';
                case 't': return '\t';
                case 'b': return '\b';
                case 'f': return '\f';
                case '"': return '"';
                case "'": return "'";
                case '\\': return '\\';
                case '/': return '/';
                default: return '\\' + c; // defensive; shouldn't hit
            }
        });

        // Leave any other backslash sequences untouched (e.g. \x, \k) to avoid over-decoding
        return inner;
    }
    // (Optional) keep a type guard too; it’s fine and helps in places without overloads
    function isTokenOpen(t: Tokens | null | undefined): t is TokenOpen {
        return !!t && t.kind === TOKEN_KIND.OPEN;
    }

    function isTokenClose(t: Tokens | null | undefined): t is TokenClose {
        return !!t && t.kind === TOKEN_KIND.CLOSE;
    }
    function isTokenText(t: Tokens | null | undefined): t is TokenText {
        return !!t && t.kind === TOKEN_KIND.TEXT;
    }
    function isTokenArrOpen(t: Tokens | null | undefined): t is TokenArrayOpen {
        return !!t && t.kind === TOKEN_KIND.ARR_OPEN;
    }
    function readTag($isTopLevel = false): { node: HsonNode; closeKind: CloseKind } {
        // NOTE: _take() returning any is sketchy; narrow immediately.
        const tok = _take();
        if (!isTokenOpen(tok)) {
            _throw_transform_err(`expected OPEN, got ${tok?.kind ?? 'eof'}`, 'parse_tokens');
        }
        const open = tok as TokenOpen;

        const { attrs, meta } = split_attrs_meta(open.rawAttrs);
        const node = CREATE_NODE( { _tag: open.tag, _meta: meta});

        // VSNs carry no _attrs
        const isVSN =
            open.tag === STR_TAG || open.tag === VAL_TAG ||
            open.tag === ARR_TAG || open.tag === OBJ_TAG ||
            open.tag === ELEM_TAG || open.tag === ROOT_TAG ||
            open.tag === II_TAG;

        if (!isVSN && Object.keys(attrs).length) {
            node._attrs = attrs;
        }

        let sawClose: TokenClose | null = null;
        const kids: HsonNode[] = [];
        let sawEmptyObjShorthand = false; // <-- NEW

        // --- gather children
        while (ix < N) {
            const t = _peek(); if (!t) break;

            // ✅ end of this tag
            if (isTokenClose(t)) {
                sawClose = _take(TOKEN_KIND.CLOSE);
                break;
            }

            // ✅ empty object shorthand "<>"
            if (t.kind === TOKEN_KIND.EMPTY_OBJ) {
                _take(TOKEN_KIND.EMPTY_OBJ);
                sawEmptyObjShorthand = true;
                continue;
            }

            // ✅ nested array
            if (isTokenArrOpen(t)) {
                kids.push(readArray());
                continue;
            }

            // ✅ nested tag
            if (isTokenOpen(t)) {
                kids.push(readTag(false).node);
                continue;
            }

            // ✅ nested text → primitive leaf
            if (isTokenText(t)) {
                const tt = _take(TOKEN_KIND.TEXT);
                const prim = tt.quoted ? decode_json_string_literal(tt.raw) : coerce(tt.raw);
                kids.push(make_leaf(prim));
                continue;
            }

            _throw_transform_err(`unexpected token ${t.kind} inside <${open.tag}>`, 'parse_tokens');
        }

        // strong narrow
        if (sawClose === null) {
            _throw_transform_err(`missing CLOSE for <${open.tag}>`, 'parse_tokens');
        }
        const closeKind: CloseKind = sawClose.close;

        // ---------- <_root>: choose cluster by its own closer; never mix modes ----------
        if (open.tag === ROOT_TAG) {
            //  explicit "<>" under root => single empty _obj cluster
            if (sawEmptyObjShorthand) {
                node._content = [CREATE_NODE({ _tag: OBJ_TAG })];
                if ($isTopLevel) topCloseKinds.push(closeKind);
                return { node, closeKind };
            }

            if (kids.length === 1 && kids[0]._tag === ARR_TAG) {
                node._content = kids; // passthrough array cluster
            } else if (kids.length > 0) {
                const clusterTag = (closeKind === CLOSE_KIND.elem) ? ELEM_TAG : OBJ_TAG;
                node._content = [CREATE_NODE({ _tag: clusterTag, _content: kids })];
            } else {
                node._content = [];
            }
            if ($isTopLevel) topCloseKinds.push(closeKind);
            return { node, closeKind };
        }

        // ---------- VSN passthroughs ----------
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
                node._content = [CREATE_NODE({
                    _tag: OBJ_TAG,
                    _content: kids as NodeContent
                })];
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
                node._content = [CREATE_NODE({
                    _tag: ELEM_TAG,
                    _content: kids as NodeContent
                })];
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
            _throw_transform_err(`expected ARR_OPEN, got ${arrOpen?.kind ?? 'eof'}`, 'parse_tokens');
        }
        const items: HsonNode[] = [];
        let idx = 0;

        while (ix < N) {
            const t = _peek(); if (!t) break;
            if (t.kind === TOKEN_KIND.ARR_CLOSE) { _take(); break; }

            let childNode: HsonNode;

            if (t.kind === TOKEN_KIND.EMPTY_OBJ) {

                _take();
                // build an empty object *item*
                childNode = CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [] });

            } else if (t.kind === TOKEN_KIND.TEXT) {
                // FIX: keep primitives inside the array (do NOT push to outer "nodes")
                const tt = _take() as TokenText;
                const prim = tt.quoted ? decode_json_string_literal(tt.raw) : coerce(tt.raw);
                childNode = make_leaf(prim); // ← was: nodes.push(...); continue;

            } else if (t.kind === TOKEN_KIND.OPEN) {
                childNode = readTag(false).node;
            } else if (t.kind === TOKEN_KIND.ARR_OPEN) {
                childNode = readArray();
            } else {
                _throw_transform_err(`unexpected ${t.kind} in array`, 'parse_tokens');
            }

            const passThruVSNs = new Set<string>([OBJ_TAG, ARR_TAG, ELEM_TAG, STR_TAG, VAL_TAG]);
            if (!passThruVSNs.has(childNode._tag)) {
                // standard tag → wrap in _obj to honor always-wrap in JSON-mode
                childNode = CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [childNode] });
            }
            childNode = unwrap_root_obj(childNode);
            items.push((CREATE_NODE({
                _tag: II_TAG,
                _meta: { [_DATA_INDEX]: String(idx) },
                _content: [childNode],
            })));
            idx++;
        }

        return CREATE_NODE({ _tag: ARR_TAG, _meta: {}, _content: items });
    }

    /* drive the stream */
    while (ix < N) {
        const t = _peek(); if (!t) break;

        if (t.kind === TOKEN_KIND.OPEN) {
            // mark top-level so we record the closer
            const { node, closeKind } = readTag(true); // <-- true
            nodes.push(node);
            topCloseKinds.push(closeKind); // <-- record
            continue;
        }
        if (t.kind === TOKEN_KIND.ARR_OPEN) {
            nodes.push(readArray());
            topCloseKinds.push('obj'); // arrays are object-closer at top
            continue;
        }
        if (t.kind === TOKEN_KIND.EMPTY_OBJ) {
            _take(TOKEN_KIND.EMPTY_OBJ);
            nodes.push(CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [] }));
            topCloseKinds.push('obj');
            continue;
        }
        if (t.kind === TOKEN_KIND.TEXT) {
            const tt = _take(TOKEN_KIND.TEXT);
            const prim = tt.quoted ? decode_json_string_literal(tt.raw) : coerce(tt.raw);
            nodes.push(make_leaf(prim));
            topCloseKinds.push('elem');
            continue;
        }

        _throw_transform_err(`unexpected top-level token ${t.kind}`, 'parse_tokens');
    }

    if (nodes.length === 1 && nodes[0]._tag === ROOT_TAG) {
        return nodes[0];
    }

    /* implicit-root fallback (no explicit <_root>) ----------------------------*/
    {
        const kids = nodes;

        // 0) single <_root> already (kept earlier) — nothing to do

        // 1) already a single cluster → keep as-is
        if (kids.length === 1 && (kids[0]._tag === OBJ_TAG || kids[0]._tag === ARR_TAG || kids[0]._tag === ELEM_TAG)) {
            const child = kids[0];
            return CREATE_NODE({ _tag: ROOT_TAG, _meta: {}, _content: [child] });
        }

        // 2) single standard tag → wrap according to its closer
        if (kids.length === 1 && typeof kids[0]._tag === 'string' && !kids[0]._tag.startsWith('_')) {
            const mode = topCloseKinds[0] === CLOSE_KIND.obj ? OBJ_TAG : ELEM_TAG; // CHANGED
            return CREATE_NODE({
                _tag: ROOT_TAG, _meta: {},
                _content: [CREATE_NODE({ _tag: mode, _meta: {}, _content: [kids[0]] })],
            });
        }

        // 3) empty → empty object cluster
        if (kids.length === 0) {
            return CREATE_NODE({
                _tag: ROOT_TAG, _meta: {},
                _content: [CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [] })],
            });
        }

        // 4) multiple top-level nodes → choose by unanimous closer; mixed ⇒ element
        const allObj = topCloseKinds.length > 0 && topCloseKinds.every(k => k === CLOSE_KIND.obj);
        const allElem = topCloseKinds.length > 0 && topCloseKinds.every(k => k === CLOSE_KIND.elem);
        const clusterTag = allObj ? OBJ_TAG : (allElem ? ELEM_TAG : ELEM_TAG); // mixed → _elem

        return CREATE_NODE({
            _tag: ROOT_TAG, _meta: {},
            _content: [CREATE_NODE({ _tag: clusterTag, _meta: {}, _content: kids })],
        });
    }

}