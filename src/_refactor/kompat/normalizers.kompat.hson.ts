// normalizers.kompat.hson.ts

import { Primitive } from "../../core/types-consts/core.types.hson";
import { _META_DATA_PREFIX } from "../../new/types-consts/constants.new.hson";
import { HsonNode_NEW, HsonAttrs_NEW, NodeContent_NEW } from "../../new/types-consts/node.new.types.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";
import { OBJ_TAG, ELEM_TAG, ARR_TAG, STR_TAG, VAL_TAG, ROOT_TAG, II_TAG } from "../../types-consts/constants.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { normalize_style } from "../_refactor-utils/compare-normalize.utils.hson";
import { sortObjectStrings, to_NEW } from "./kompat-layer.refactor.hson";



/* debug log */
let _VERBOSE = true;
const STYLE = 'color:yellow;font-weight:400;padding:1px 3px;border-radius:4px';
// tweak _log to style every arg (incl. your prefix), no helpers:
const _log = _VERBOSE
    ? (...args: unknown[]) =>
        console.log(
            ['%c%s', ...args.map(() => '%c%o')].join(' '),
            STYLE, '[nrmlz] →',
            ...args.flatMap(a => [STYLE, a]),
        )
    : () => { };


/* --------------------------------------------
 * normalizeNEWStrict: structural-only, NEW-only
 * --------------------------------------------
 * - REMOVED: calls to to_NEW() and parse_primitive()
 * - ADDED: cycle guard (WeakSet)
 * - ADDED: move any _attrs['data-_…'] into _meta (stringified)
 * - KEPT: style normalization, meta string coercion, _obj/_elem→_arr collapse
 */

export function normalizeNEWStrict(v: HsonNode_NEW): HsonNode_NEW;
export function normalizeNEWStrict(v: HsonNode_NEW[]): HsonNode_NEW[];
export function normalizeNEWStrict(
    v: HsonNode_NEW | HsonNode_NEW[],
    _seen = new WeakSet<object>() /* ADDED: cycle guard */
): HsonNode_NEW | HsonNode_NEW[] {
    if (Array.isArray(v)) {
        // CHANGED: NEW-only; do not coerce here
        return (v as HsonNode_NEW[]).map(n => normalizeNEWNode(n, _seen));
    }
    // v is HsonNode_NEW here
    return normalizeNEWNode(v as HsonNode_NEW, _seen);
}

/* CHANGED: new helper — one node, structural-only */
function normalizeNEWNode(n: HsonNode_NEW, seen: WeakSet<object>): HsonNode_NEW {
    /* ADDED: cycle detect */
    if (seen.has(n)) throw new Error("normalizeNEWStrict: cycle detected");
    seen.add(n);

    const _tag = n._tag;

    /* SHALLOW COPIES */
    const srcAttrs = { ...(n._attrs ?? {}) } as Record<string, Primitive | Record<string, string>>;
    const meta = { ...(n._meta ?? {}) } as Record<string, string>;

    /* STYLE: normalize to canonical object; drop if empty */
    if (typeof srcAttrs.style === "string" || typeof srcAttrs.style === "object") {
        const st = srcAttrs.style;
        if (st && Object.keys(st).length) srcAttrs.style = st; else delete srcAttrs.style;
    }

    /* MOVE any 'data-_' from _attrs → _meta (stringified) */
    const userAttrs: HsonAttrs_NEW = {};
    for (const [k, v] of Object.entries(srcAttrs)) {
        if (k.startsWith(_META_DATA_PREFIX)) {
            if (v != null) meta[k] = String(v); /* ADDED */
        } else {
            userAttrs[k] = v as Primitive;
        }
    }

    /* COERCE meta 'data-_' values to strings */
    for (const k of Object.keys(meta)) {
        if (k.startsWith(_META_DATA_PREFIX) && meta[k] != null) meta[k] = String(meta[k]);
    }

    /* CHILDREN: recurse NEW nodes only; do NOT coerce primitives/OLD here */
    const raw = Array.isArray(n._content) ? n._content : [];
    let kids = raw.map((c): HsonNode_NEW | Primitive =>
        is_Node_NEW(c) ? normalizeNEWNode(c as HsonNode_NEW, seen) : (c as Primitive)  /* CHANGED */
    );

    /* COLLAPSE: [_obj|_elem([_arr])] → [_arr] */
    if (kids.length === 1 && is_Node_NEW(kids[0])) {
        const k0 = kids[0] as HsonNode_NEW;
        if (k0._tag === OBJ_TAG || k0._tag === ELEM_TAG) {
            const kk = Array.isArray(k0._content) ? k0._content : [];
            if (kk.length === 1 && is_Node_NEW(kk[0]) && (kk[0] as HsonNode_NEW)._tag === ARR_TAG) {
                kids = [kk[0] as HsonNode_NEW];
            }
        }
    }

    /* VSNs carry no _attrs */
    const isVSN =
        _tag === STR_TAG || _tag === VAL_TAG || _tag === ARR_TAG ||
        _tag === OBJ_TAG || _tag === ELEM_TAG || _tag === ROOT_TAG || _tag === II_TAG;

    return {
        _tag,
        _attrs: isVSN ? undefined : (Object.keys(userAttrs).length ? userAttrs : undefined),
        _meta: meta,          /* stable order */
        _content: kids as NodeContent_NEW,
    };
}

/* --------------------------------------------
 * normalizeNode: wrapper that does the coercion
 * --------------------------------------------
 * - CHANGED: convert OLD→NEW once, then normalize.
 * - No recursion between normalize and to_NEW.
 */

function normalizeSingleNode(v: HsonNode | HsonNode_NEW): HsonNode_NEW {
    /* CHANGED: coerce outside the normalizer */
    const asNEW = is_Node_NEW(v as any) ? (v as HsonNode_NEW) : to_NEW(v as HsonNode);
    return normalizeNEWStrict(asNEW) as HsonNode_NEW;
}

export function normalizeNode(v: HsonNode | HsonNode_NEW): HsonNode_NEW;
export function normalizeNode(v: (HsonNode | HsonNode_NEW)[]): HsonNode_NEW[];
export function normalizeNode(
    v: HsonNode | HsonNode_NEW | (HsonNode | HsonNode_NEW)[]
): HsonNode_NEW | HsonNode_NEW[] {
    _log('normalizeNode()');
    return Array.isArray(v)
        ? (v as (HsonNode | HsonNode_NEW)[]).map(normalizeSingleNode)
        : normalizeSingleNode(v as HsonNode | HsonNode_NEW);
}