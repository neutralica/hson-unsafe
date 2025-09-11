// --- serialize-hson.render.ts ---

import { Primitive } from "../../core/types-consts/core.types";
import { ARR_TAG, ELEM_TAG, EVERY_VSN, II_TAG, OBJ_TAG, ROOT_TAG, STR_TAG, VAL_TAG } from "../../types-consts/constants";
import { _snip } from "../../utils/snip.utils";
import { serialize_style } from "../../utils/serialize-css.utils";
import { serialize_primitive } from "../../utils/serialize-primitive.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
import { is_Node_NEW } from "../../utils/node-guards.new.utils";
import { assert_invariants_NEW } from "../../utils/assert-invariants.utils";
import { _META_DATA_PREFIX } from "../../types-consts/constants";
import { HsonAttrs_NEW, HsonMeta_NEW, HsonNode_NEW } from "../../types-consts/node.new.types";

// --- serialize-hson.render.ts ---
//
// CHANGES vs OLD:
// • Uses NEW node model: _attrs + _meta('data-_'*) instead of old meta.attrs/flags.
// • Never emits VSNs on HSON wire (except current, intentional <_root …> container).
// • Splits _str vs _val emission (quoted string vs raw JSON literal).
// • Merges user _attrs + _meta[data-_…] into tag attributes; flags as bare tokens.
// • Sorts children under _obj; preserves order under _elem; arrays render as « … ».
// • One-liner rule requires: no attrs, no meta, single child that is _str/_val.
//
// Notes:
// • _ii must never appear on HSON wire; if encountered, we unwrap its single child.
// • _arr is a first-class cluster (no legacy {_obj: [_arr]}).
// • _meta values are strings; only keys with "data-_" prefix are allowed.


/* debug log */
let _VERBOSE = false;
const STYLE = 'color:dodgerblue;font-weight:400;padding:1px 3px;border-radius:4px';
const _log = _VERBOSE
    ? (...args: unknown[]) =>
        console.log(
            ['%c%s', ...args.map(() => '%c%o')].join(' '),
            STYLE, '[serialize-hson_NEW] →',
            ...args.flatMap(a => [STYLE, a]),
        )
    : () => { };

function cycleGuard() {
    const seen = new WeakSet<object>();
    return {
        enter(node: object) {
            if (seen.has(node)) {
                _throw_transform_err("serialize-hson: cycle detected in node graph", 'serialize_hson_NEW.cycleGuard.enter');
            }
            seen.add(node);
        },
        leave(node: object) {
            // optional: omit to reduce overhead; keeping it avoids memory growth across huge trees
            seen.delete(node);
        }
    };
}


/* attrs considered empty if absent or has no own keys (style:"" counts as present) */
function isEmptyAttrs(attrs?: HsonAttrs_NEW): boolean {
    if (!attrs) return true;
    for (const _k in attrs) return false;
    return true;
}

/*  meta must only contain data-_* keys and string values */
function assertAndReturnMeta(meta?: HsonMeta_NEW): Record<string, string> {
    _log('assert & return _meta')
    if (!meta) return {};
    const out: Record<string, string> = {};
    for (const k of Object.keys(meta)) {
        if (!k.startsWith(_META_DATA_PREFIX)) {
            _throw_transform_err(`serialize-hson: illegal meta key "${k}" (only "${_META_DATA_PREFIX}*" allowed)`, 'serialize_hson');
        }
        const v = (meta as Record<string, unknown>)[k];
        if (typeof v !== "string") {
            _throw_transform_err(`serialize-hson: meta "${k}" must be a string`, 'serialize_hson');
        }
        out[k] = v;
    }
    return out;
}

/* durable: stringify NEW attrs (incl. style object and flags as bare tokens) */
function formatAttrsNEW(attrs: HsonAttrs_NEW | undefined): string {
    if (!attrs) return "";
    const entries = Object.entries(attrs);
    if (!entries.length) return "";
    _log('formatting _attrs')


    // partition without sorting: non-flags first, then flags (value === key)
    const nonFlags = entries.filter(([k, v]) => v !== k);
    const flags = entries.filter(([k, v]) => v === k);

    const kv = (k: string, v: Primitive | Record<string, string>) => {
        if (k === "style" && v && typeof v === "object" && !Array.isArray(v)) {
            // style object → canonical CSS string
            return ` style="${serialize_style(v as Record<string, string>)}"`;
        }
        if (typeof v === "string") {
            return ` ${k}="${v.replace(/"/g, '\\"')}"`;
        }
        return ` ${k}=${String(v)}`;
    };

    const parts: string[] = [];
    for (const [k, v] of nonFlags) parts.push(kv(k, v as any));
    for (const [k] of flags) parts.push(` ${k}`); // flags as bare keys

    return parts.join("");
}

/* merge user _attrs and meta(data-_) into a single on-wire attrs string */
function buildAttrString(attrs: HsonAttrs_NEW | undefined, meta: HsonMeta_NEW | undefined): string {
    _log('building attrs string');
    const user = formatAttrsNEW(attrs);
    const sys = (() => {
        const m = assertAndReturnMeta(meta);
        if (!Object.keys(m).length) return "";
        const parts = Object.keys(m).sort().map(k => ` ${k}="${m[k].replace(/"/g, '\\"')}"`);
        return parts.join("");
    })();
    return `${user}${sys}`;
}

/* quoted text vs raw primitive one-liner probe (NEW shape only) */
function getSelfCloseValueNEW(node: HsonNode_NEW): Primitive | null {
    _log('getting value for self-closing Node (_NEW type)');
    // must not carry attrs or meta
    if (!isEmptyAttrs(node._attrs)) return null;
    if (node._meta && Object.keys(node._meta).length) return null;

    // must have exactly one child which is a node
    if (!node._content || node._content.length !== 1 || !is_Node_NEW(node._content[0])) {
        return null;
    }
    const only = node._content[0] as HsonNode_NEW;
    if (!only._content || only._content.length !== 1) return null;

    const prim = only._content[0];
    if (only._tag === STR_TAG && typeof prim === "string") return prim;
    if (only._tag === VAL_TAG && (typeof prim === "number" || typeof prim === "boolean" || prim === null)) {
        return prim;
    }
    return null;
}

/* -------------------------------------------------------------------------- */
/* core serializer                                                      */
/* -------------------------------------------------------------------------- */


type ParentCluster = typeof OBJ_TAG | typeof ELEM_TAG;

/* recursively serialize a NEW node into HSON wire */

function emitNode(
    node: HsonNode_NEW,
    depth: number,
    parentCluster: ParentCluster | undefined,
    guard: ReturnType<typeof cycleGuard>
): string {
    _log('entering emitNode()');
    guard.enter(node);
    try {
        const pad = "  ".repeat(depth);

        if (node._tag.startsWith("_") && !EVERY_VSN.includes(node._tag)) {
            _throw_transform_err(`unknown VSN-like tag: <${node._tag}>`, 'parse-html');
        }

        /* 1) VSN leafs: _str / _val */
        if (node._tag === STR_TAG || node._tag === VAL_TAG) {
            _log('leaf node detected: ', node._tag);
            if (!node._content || node._content.length !== 1) {
                _throw_transform_err(`serialize-hson: ${node._tag} must contain exactly one primitive`, 'serialize_hson_NEW.cycleGuard.enter');
            }
            const v = node._content[0];

            if (node._tag === STR_TAG) {
                if (typeof v !== "string") {
                    const v = node._content?.[0];
                    console.warn("STR payload not string:", v, node);
                    _throw_transform_err(`serialize-hson: _str must contain a string`, 'serialize_hson_NEW.emitNode()')
                }
                return pad + JSON.stringify(v);
            }

            if (!(typeof v === "number" || typeof v === "boolean" || v === null)) {
                _throw_transform_err("serialize-hson: _val must contain number|boolean|null : ", 'serialize_hson_NEW.emitNode()', `${v}`);
            }
            return pad + String(v);
        }

        /* 2) _ii should not be on HSON wire — unwrap defensively if leaked */
        if (node._tag === II_TAG) {
            _log('index node detected');
            const c = node._content?.[0];
            if (!c || typeof c !== "object" || !("_tag" in (c as any))) {
                _throw_transform_err("serialize-hson: _ii must contain exactly one child node", 'serialize_hson_NEW.emitNode()');
            }
            return emitNode(c as HsonNode_NEW, depth, parentCluster, guard);  // <-- same depth
        }

        /* 3) _arr cluster → « … » */
        if (node._tag === ARR_TAG) {
            _log('array node detected');
            const items = node._content ?? [];
            if (!items.length) return `${pad}«»`;
            const inner = items
                .map((child: unknown) =>
                    (typeof child === "object" && child && "_tag" in (child as any))
                        ? emitNode(child as HsonNode_NEW, depth + 1, undefined, guard)  // child cluster context will be set below
                        : pad + String(child) // tolerant; normalized NEW shouldn’t have bare primitives
                )
                .join(",\n");
            return `${pad}«\n${inner}\n${pad}»`;
        }

        /* 4) _obj / _elem clusters: melt; never emit their tags */
        if (node._tag === OBJ_TAG || node._tag === ELEM_TAG) {
            _log('cluster node detected: ', node._tag);
            if (node._attrs && Object.keys(node._attrs).length) {
                _throw_transform_err(`serialize-hson: ${node._tag} may not carry _attrs`, 'serialize_hson_NEW.emitNode()');
            }
            const kids = (node._content ?? []).filter(
                (k: unknown) => typeof k === "object" && k && "_tag" in (k as any)
            ) as HsonNode_NEW[];

            const cluster: ParentCluster = node._tag;
            return kids.map(k => emitNode(k, depth, cluster, guard)).join("\n");
        }

        /* 5) _root: keep on wire (current policy); choose closer by melted child */
        if (node._tag === ROOT_TAG) {
            _log('_root tag encountered!');
            const kids = (node._content ?? []).filter(
                (k: unknown) => typeof k === "object" && k && "_tag" in (k as any)
            ) as HsonNode_NEW[];
            if (kids.length !== 1) throw new Error("serialize-hson: _root must have exactly one cluster child");

            const cluster = kids[0];
            if (!(cluster._tag === OBJ_TAG || cluster._tag === ELEM_TAG || cluster._tag === ARR_TAG)) {
                _throw_transform_err("serialize-hson: _root child must be _obj | _elem | _arr", 'serialize_hson_NEW');
            }

            const attrsStr = buildAttrString(node._attrs, node._meta);
            const closer = cluster._tag === ELEM_TAG ? "/>" : ">";
            const nextParent: ParentCluster = (cluster._tag === ARR_TAG) ? OBJ_TAG : cluster._tag;
            const inner = emitNode(cluster, depth + 1, nextParent, guard);
            return `${pad}<${node._tag}${attrsStr}\n${inner}\n${pad}${closer}`;
        }

        /* 6) Standard tag element */

        // neu

        const INLINE_VSNS = new Set<string>([STR_TAG, VAL_TAG]);

        function hasOwnProps(o: object | undefined | null): boolean {
            return !!(o && Object.keys(o).length);
        }

        function inlineShape(n: HsonNode_NEW):
            | { kind: 'void' }
            | { kind: 'text'; value: Primitive }
            | null {

            // must have no attrs/meta payload (empty objects are OK)
            if (hasOwnProps(n._attrs)) return null;
            if (hasOwnProps(n._meta)) return null;

            const c = n._content ?? [];

            // empty -> <tag />
            if (c.length === 0) return { kind: 'void' };

            // exactly one child: could be _str/_val OR an _elem wrapper
            if (c.length === 1 && typeof c[0] === "object" && c[0] && "_tag" in c[0]) {
                let child = c[0] as HsonNode_NEW;

                // unwrap a single _elem wrapper (HTML-origin nodes often look like: tag -> _elem -> _str/_val)
                if (child._tag === ELEM_TAG) {
                    const ec = child._content ?? [];
                    if (ec.length === 0) return { kind: 'void' }; // <tag><_elem /></tag> -> treat as void
                    if (ec.length === 1 && typeof ec[0] === "object" && ec[0] && "_tag" in ec[0]) {
                        child = ec[0] as HsonNode_NEW;
                    } else {
                        return null;
                    }
                }

                // now check primitive wrappers
                if (INLINE_VSNS.has(child._tag)) {
                    const v = child._content?.[0];
                    if (v === undefined) return null;
                    // keep strings single-line only
                    if (typeof v === "string" && v.includes("\n")) return null;
                    return { kind: 'text', value: v as Primitive };
                }
            }

            return null;
        }

        // primitive -> HSON literal (same logic you already have)
        function emit_primitive_as_hson(p: Primitive): string {
            return typeof p === 'string' ? JSON.stringify(p) : String(p);
        }

        // ---- use it right before your multiline path ----
        const shape = inlineShape(node);
        if (shape) {
            // IMPORTANT: return early so you don’t fall through to your multiline branch
            return shape.kind === 'void'
                ? `${pad}<${node._tag} />`
                : `${pad}<${node._tag} ${emit_primitive_as_hson(shape.value)} />`;
        }


        _log('building attrs string for standard tag');
        const attrsStr = buildAttrString(node._attrs, node._meta);

        // One-liner primitive value (no attrs/meta; single _str/_val child)
        const selfVal = getSelfCloseValueNEW(node);
        if (selfVal !== null) {

            const val = serialize_primitive(selfVal);
            const closer = parentCluster === ELEM_TAG ? "/>" : ">";
            return `${pad}<${node._tag}${attrsStr} ${val} ${closer}`;
        }

        const children = (node._content ?? []).filter(
            (k: unknown) => is_Node_NEW
        ) as HsonNode_NEW[];

        if (!children.length) {
            _log('void node; closing');
            const closer = parentCluster === ELEM_TAG ? "/>" : ">";
            return `${pad}<${node._tag}${attrsStr} ${closer}`;
        }

        // Melt single structural child if present
        _log('unwrapping cluster VSN and getting closer')
        if (children.length === 1 && (children[0]._tag === OBJ_TAG || children[0]._tag === ELEM_TAG || children[0]._tag === ARR_TAG)) {
            const melted = children[0];
            const hostCloser = melted._tag === ELEM_TAG ? "/>" : ">";
            const nextParent: ParentCluster = melted._tag === ARR_TAG ? OBJ_TAG : melted._tag as ParentCluster;
            const inner = emitNode(melted, depth + 1, nextParent, guard);
            return `${pad}<${node._tag}${attrsStr}\n${inner}\n${pad}${hostCloser}`;
        }

        // Fallback: element semantics (ordered)
        const inner = children.map(ch => emitNode(ch, depth + 1, ELEM_TAG, guard)).join("\n");
        return `${pad}<${node._tag}${attrsStr}\n${inner}\n${pad}/>`;
    } finally {
        guard.leave(node);
    }
}

/* public API (NEW) */
export function serialize_hson(root: HsonNode_NEW): string {
    if (!is_Node_NEW(root)) {
        _throw_transform_err("serialize-hson: root must be a HsonNode_NEW", 'serialize-hson');
    }
    assert_invariants_NEW(root);
    const guard = cycleGuard();
    const out = emitNode(root, 0, undefined, guard);
    return out.trim();
}