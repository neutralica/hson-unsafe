// --- serialize-hson.render.ts ---

import { Primitive } from "../../core/types-consts/core.types";
import { ARR_TAG, ELEM_OBJ_ARR, ELEM_TAG, EVERY_VSN, II_TAG, OBJ_TAG, ROOT_TAG, STR_TAG, VAL_TAG } from "../../types-consts/constants";
import { _snip } from "../../utils/snip.utils";
import { serialize_style } from "../../utils/serialize-css.utils";
import { serialize_primitive } from "../../utils/serialize-primitive.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
import { is_Node } from "../../utils/node-guards.new.utils";
import { assert_invariants } from "../../utils/assert-invariants.utils";
import { _META_DATA_PREFIX } from "../../types-consts/constants";
import { HsonAttrs, HsonMeta, HsonNode } from "../../types-consts/node.new.types";
import { make_string } from "../../utils/make-string.utils";

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
function isEmptyAttrs(attrs?: HsonAttrs): boolean {
    if (!attrs) return true;
    for (const _k in attrs) return false;
    return true;
}

/*  meta must only contain data-_* keys and string values */
function assertAndReturnMeta(meta?: HsonMeta): Record<string, string> {
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
function formatAttrsNEW(attrs: HsonAttrs | undefined): string {
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
function buildAttrString(attrs: HsonAttrs | undefined, meta: HsonMeta | undefined): string {
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
function getSelfCloseValueNEW(node: HsonNode): Primitive | undefined {
    _log('getting value for self-closing Node (_NEW type)');

    // must not carry attrs or meta
    if (!isEmptyAttrs(node._attrs)) return undefined;
    if (node._meta && Object.keys(node._meta).length) return undefined;

    // must have exactly one child which is a node
    if (!node._content || node._content.length !== 1 || !is_Node(node._content[0])) {
        return undefined;
    }

    // unwrap at most one level of _obj to reach the scalar leaf
    let child = node._content[0] as HsonNode;

    if (child._tag === OBJ_TAG) {
        const objKids = child._content as HsonNode[] | undefined;
        if (!objKids || objKids.length !== 1 || !is_Node(objKids[0])) return undefined;
        child = objKids[0] as HsonNode;
    }

    // leaf must have exactly one primitive payload
    if (!child._content || child._content.length !== 1) return undefined;
    const prim = child._content[0] as unknown;

    if (child._tag === STR_TAG) {
        return (typeof prim === "string") ? (prim as string) : undefined;
    }

    if (child._tag === VAL_TAG) {
        return (typeof prim === "number" || typeof prim === "boolean" || prim === null)
            ? (prim as Primitive)
            : undefined;
    }

    return undefined;
}


/* -------------------------------------------------------------------------- */
/* core serializer                                                      */
/* -------------------------------------------------------------------------- */


type ParentCluster = typeof OBJ_TAG | typeof ELEM_TAG | typeof ARR_TAG;


/* recursively serialize a NEW node into HSON wire */

function emitNode(
    node: HsonNode,
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
            if (!is_Node(c)) {
                _throw_transform_err("serialize-hson: _ii must contain exactly one child node", 'serialize_hson_NEW.emitNode()');
            }
            return emitNode(c, depth, parentCluster, guard);  // <-- same depth
        }
        /* 3) _arr cluster → « … » */
        if (node._tag === ARR_TAG) {
            const items = (node._content ?? []) as HsonNode[];
            if (!items.length) return `${pad}«»`;

            const subpad = pad + "  ";

            const inner = items.map((it) => {
                if (!is_Node(it)) {
                    _throw_transform_err('serialize-hson: non-node item in _arr', 'emitNode');
                }

                // Unwrap leaked _ii (shouldn’t be on wire)
                let item = it;
                if (item._tag === II_TAG) {
                    const c = item._content?.[0];
                    if (!is_Node(c)) {
                        _throw_transform_err('serialize-hson: _ii must contain exactly one child node', 'emitNode');
                    }
                    item = c as HsonNode;
                }

                if (item._tag === OBJ_TAG) {
                    const props = (item._content ?? []) as HsonNode[];
                    if (props.length === 0) {
                        // Empty object item: shorthand
                        return `${subpad}<>`;
                    }
                    // Non-empty object item: explicit object-cluster wrapper
                    const body = props.map(p => emitNode(p, depth + 2, OBJ_TAG, guard)).join("\n");
                    return `${subpad}<\n${body}\n${subpad}>`;
                }

                // Non-object items (arrays/elements/scalars): emit as-is
                return emitNode(item, depth + 1, undefined, guard);
            }).join(",\n");

            return `${pad}«\n${inner}\n${pad}»`;
        }



        /* 5) _root: keep on wire (current policy); choose closer by melted child */
        if (node._tag === ROOT_TAG) {
            // _root never carries attrs/meta in wire form; if present that’s a higher-level invariant error,
            // but the serializer should ignore them (do NOT emit them).
            const kids = (node._content ?? []) as HsonNode[];

            // 1) Empty explicit <_root> → empty object cluster shorthand
            if (kids.length === 0) {
                // Prefer the canonical empty-obj under root:
                // <_root
                //   <>
                // >
                return `<${ROOT_TAG}\n${pad}<>\n>`;
            }

            // 2) Must have exactly one cluster child
            if (kids.length !== 1) {
                _throw_transform_err('_root must have exactly one cluster child', 'serialize_hson_NEW', make_string(kids));
            }
            const cluster = kids[0];

            if (!ELEM_OBJ_ARR.includes(cluster._tag)) {
                _throw_transform_err('_root child must be _obj | _elem | _arr', 'serialize_hson_NEW', make_string(cluster));
            }

            // 3) Do NOT normalize/wrap here. Propagate the child cluster as-is.
            //    We also DO NOT convert ARR→OBJ anymore. Whatever cluster is present, we emit it raw.
            const inner = emitNode(
                cluster /* unchanged */,
                depth + 1,
                cluster._tag as ParentCluster /* parentCluster = child */,
                guard
            );

            // --- CHANGED: choose _root closer based on the child kind
            // _elem → '/>'  ;  _obj/_arr → '>'
            const rootCloser = (cluster._tag === ELEM_TAG) ? '/>' : '>';

            // Keep the same newline formatting: closer on its own line, left-aligned (no pad),
            // to match previous emissions and your examples.
            return `<${ROOT_TAG}\n${pad}${inner}\n${rootCloser}`;
        }

        /* 4) _obj / _elem clusters: melt; never emit their tags */
        if (node._tag === OBJ_TAG || node._tag === ELEM_TAG) {
            _log('cluster node detected: ', node._tag);
            if (node._attrs && Object.keys(node._attrs).length) {
                _throw_transform_err(`serialize-hson: ${node._tag} may not carry _attrs`, 'serialize_hson_NEW.emitNode()');
            }

            const kids = (node._content ?? []) as HsonNode[];

            if (node._tag === OBJ_TAG && kids.length === 0) {
                return `${pad}<>`;
            }
            const cluster: ParentCluster = node._tag;
            if (node._tag === OBJ_TAG) {
                return kids.map(prop => {
                    // narrow
                    if (!is_Node(prop)) {
                        _throw_transform_err("serialize-hson: non-node in _obj._content", "emitNode");
                    }
                    const key = prop._tag as string;
                    const inner = (Array.isArray(prop._content) ? prop._content[0] : null) as HsonNode | null;
                    if (!inner) return `${pad}<${key} />`;

                    // Dive through wrapper _obj if present
                    const rendered =
                        inner._tag === OBJ_TAG
                            ? (inner._content as HsonNode[])
                                .map(grand => emitNode(grand, depth + 1, cluster, guard))
                                .join("\n")
                            : emitNode(inner, depth + 1, cluster, guard);

                    return `${pad}<${key}\n${rendered}\n${pad}>`;
                }).join("\n");
            }
            return kids.map(k => emitNode(k, depth, cluster, guard)).join("\n");
        }


        /* 6) Standard tag element */
        const INLINE_VSNS = new Set<string>([STR_TAG, VAL_TAG]);

        function hasOwnProps(o: object | undefined | null): boolean {
            return !!(o && Object.keys(o).length);
        }

        function inlineShape(n: HsonNode):
            | { kind: 'void' }
            | { kind: 'text'; value: Primitive }
            | undefined {

            // must have no attrs/meta payload (empty objects are OK)
            if (hasOwnProps(n._attrs)) return undefined;
            if (hasOwnProps(n._meta)) return undefined;

            const c = n._content ?? [];

            // empty -> <tag />
            if (c.length === 0) return { kind: 'void' };

            // exactly one child: could be _str/_val OR an _elem wrapper
            if (c.length === 1 && typeof c[0] === "object" && c[0] && "_tag" in c[0]) {
                let child = c[0] as HsonNode;

                // unwrap a single _elem wrapper (HTML-origin nodes often look like: tag -> _elem -> _str/_val)
                if (child._tag === ELEM_TAG) {
                    const ec = child._content ?? [];
                    if (ec.length === 0) return { kind: 'void' }; // <tag><_elem /></tag> -> treat as void
                    if (ec.length === 1 && typeof ec[0] === "object" && ec[0] && "_tag" in ec[0]) {
                        child = ec[0] as HsonNode;
                    } else {
                        return undefined;
                    }
                }

                // now check primitive wrappers
                if (INLINE_VSNS.has(child._tag)) {
                    const v = child._content?.[0];
                    if (v === undefined) return undefined;
                    // keep strings single-line only
                    if (typeof v === "string" && v.includes("\n")) return undefined;
                    return { kind: 'text', value: v as Primitive };
                }
            }

            return undefined;
        }

        // primitive -> HSON literal (same logic you already have)
        function emit_primitive_as_hson(p: Primitive): string {
            return typeof p === 'string' ? JSON.stringify(p) : String(p);
        }

        _log('building attrs string for standard tag');
        const attrsStr = buildAttrString(node._attrs, node._meta);

        const shape = inlineShape(node);
        if (shape !== undefined) {
            if (parentCluster === OBJ_TAG) {
                // JSON-mode: block with primitive inside
                if (shape.kind === 'void') {
                    return `${pad}<${node._tag}${attrsStr}\n${pad}  <>\n${pad}>`;
                } else {
                    return `${pad}<${node._tag}${attrsStr}\n${pad}  ${emit_primitive_as_hson(shape.value)}\n${pad}>`;
                }
            }
            // HTML-mode: allow one-liner
            return shape.kind === 'void'
                ? `${pad}<${node._tag}${attrsStr} />`
                : `${pad}<${node._tag}${attrsStr} ${emit_primitive_as_hson(shape.value)} />`;
        }

        // One-liner primitive value (no attrs/meta; single _str/_val child)
        const selfVal = getSelfCloseValueNEW(node);
        if (selfVal !== undefined) {
            if (parentCluster === OBJ_TAG) {
                // block in JSON-mode
                return `${pad}<${node._tag}${attrsStr}  ${serialize_primitive(selfVal)}>`;
            }
            // element semantics ok to self-close
            return `${pad}<${node._tag}${attrsStr} ${serialize_primitive(selfVal)} />`;
        }

        const children = (node._content ?? []) as HsonNode[];

        if (!children.length) {
            if (parentCluster === OBJ_TAG) {
                // empty property in object semantics → explicit empty object cluster
                return `${pad}<${node._tag}${attrsStr}\n${pad}  <>\n${pad}>`;
            } else {
                // element semantics may self-close
                return `${pad}<${node._tag}${attrsStr} />`;
            }
        }

        // Decide closer by *single* child cluster (elem → '/>', obj/arr → '>').
        // If the shape isn’t a single cluster, prefer element closer to avoid obj-mode drift.
        let closer = '/>';
        if (
            children.length === 1 &&
            is_Node(children[0]) &&
            (children[0]._tag === OBJ_TAG || children[0]._tag === ARR_TAG || children[0]._tag === ELEM_TAG)
        ) {
            closer = (children[0]._tag === ELEM_TAG) ? '/>' : '>';
        }

        const inner = children
            .map(ch => emitNode(
                ch,
                depth + 1,
                // arrays live under _obj semantics when printed
                ch._tag === ARR_TAG ? OBJ_TAG : parentCluster,
                guard
            ))
            .filter(s => /\S/.test(s)) // drop pure-whitespace emissions
            .join("\n");

        // If nothing actually rendered, self-close regardless of computed closer.
        if (inner.length === 0) {
            return `${pad}<${node._tag}${attrsStr} />`;
        }

        // Use the computed closer.
        return `${pad}<${node._tag}${attrsStr}\n${inner}\n${pad}${closer}`;
    } finally {
        guard.leave(node);
    }
}

/* public API (NEW) */
export function serialize_hson(root: HsonNode): string {
    if (!is_Node(root)) {
        _throw_transform_err("serialize-hson: root must be a HsonNode_NEW", 'serialize-hson');
    }
    assert_invariants(root, 'serialize_hson');
    const guard = cycleGuard();
    const out = emitNode(root, 0, undefined, guard);
    return out.trim();
}