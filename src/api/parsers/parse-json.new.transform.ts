// parse-json.transform.hson.ts

import { HsonNode, Primitive } from "../..";
import { is_Primitive, is_Object } from "../../core/utils/guards.core.utils";
import { VAL_TAG, STR_TAG, ARR_TAG, OBJ_TAG, EVERY_VSN, II_TAG, ELEM_TAG, ROOT_TAG } from "../../types-consts/constants";
import { NEW_NEW_NODE } from "../../types-consts/factories";
import { _DATA_INDEX, _META_DATA_PREFIX } from "../../types-consts/constants";
import { JsonType, HsonMeta, JsonObj, HsonAttrs } from "../../types-consts/node.new.types";
import { assert_invariants_NEW } from "../../utils/assert-invariants.utils";
import { is_not_string_NEW } from "../../utils/node-guards.new.utils";
import { _snip } from "../../utils/snip.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
import { make_string } from "../../utils/make-string.utils";



function dataOnlyMeta(meta: unknown): HsonMeta {
    const rec = (meta && typeof meta === "object" && !Array.isArray(meta))
        ? (meta as Record<string, unknown>)
        : undefined;

    const out: HsonMeta = {};
    if (!rec) return out;

    for (const [k, v] of Object.entries(rec)) {
        if (k.startsWith(_META_DATA_PREFIX)) out[k] = v == null ? "" : String(v);
    }
    return out;
}

function getTag($value: JsonType): string {
    // 1) Collections first (so they aren't misclassified as "not string")
    if (Array.isArray($value)) return ARR_TAG;            // _arr
    if (is_Object($value)) return OBJ_TAG;              // _obj

    // 2) Scalars
    if (typeof $value === 'string') return STR_TAG;       // _str
    if ($value === null || typeof $value === 'number' || typeof $value === 'boolean') {
        return VAL_TAG;                                   // _val (num|bool|null)
    }

    _throw_transform_err('invalid value provided', 'getTag', $value);
}


/**
 * recursively parses a json string or a javascript object into the
 * canonical hson node structure.
 *
 * all parsers adhere to the "always wrap" principle 
 * the properties of a json object will be contained within a single '_obj'
 *  vsn 
 * 
 * (the items of a json array will be contained within an '_array' vsn, which behaves differently)
 *
 * @param {string | JsonType} $srcJson - the json data to parse, either as a raw string or a pre-parsed javascript object/array.
 * @param {string} $parentTag - the parent tag, usually necessary for determining which VSN to create 
 * @returns {HsonNode} the root hsonnode of the resulting data structure.
 */

function nodeFromJson(
    $srcJson: JsonType,
    $parentTag: string
): { node: HsonNode } {
    /* catch primitive nodes */

    if ($parentTag.startsWith("_") && !EVERY_VSN.includes($parentTag)) {
        _throw_transform_err(`unknown VSN-like tag: <${$parentTag}>`, 'parse-html', make_string($srcJson));
    }

    if ($parentTag === STR_TAG || $parentTag === VAL_TAG) {
        if (!is_Primitive($srcJson)) {
            _throw_transform_err('values must be string, bool, number, or null', 'parse_json');
        }
        if (is_not_string_NEW($srcJson)) {
            return {
                node: NEW_NEW_NODE({
                    _tag: VAL_TAG,
                    _content: [$srcJson as Primitive],
                }),
            };
        } else {
            const node = NEW_NEW_NODE({
                _tag: STR_TAG,
                _content: [$srcJson as Primitive],
            });
            return { node };
        }
    }

    /*  arrays -> _array VSN */
    if ($parentTag === ARR_TAG) {
        const array = $srcJson as JsonType[];
        const items: HsonNode[] = array.map((val, ix) => {
            const itemStructuralTag = getTag(val);
            const itemConversion = nodeFromJson(val, itemStructuralTag);

            let dataIx: HsonMeta = { [_DATA_INDEX]: String(ix) };

            return NEW_NEW_NODE({
                _tag: II_TAG, /* <_ii> wrapper */
                _content: [itemConversion.node], /* the item itself */
                _meta: dataIx
            });
        });
        return {
            node: NEW_NEW_NODE({
                _tag: ARR_TAG,
                _content: items,
            }),
        };
    }

    /* catch objects */
    if ($parentTag === OBJ_TAG) {
        const RESERVED = new Set(["_attrs", "_meta", "_elem", "_obj", "_arr", "_ii", "_root", "_str", "_val"]);

        if ($srcJson && typeof $srcJson === "object" && !Array.isArray($srcJson)) {
            const obj = $srcJson as Record<string, unknown>;

            // pull reserved (attrs flow to the ELEMENT; meta gets filtered to data-_)
            const objAttrs: HsonAttrs | undefined =
                (obj._attrs && typeof obj._attrs === "object" && !Array.isArray(obj._attrs))
                    ? (obj._attrs as HsonAttrs)
                    : undefined;

            const objMeta: HsonMeta = dataOnlyMeta(obj._meta);

            const nonReservedKeys = Object.keys(obj).filter(k => !RESERVED.has(k));

            // ─────────────────────────────────────────────────────────────
            // ELEMENT-OBJECT: exactly one non-reserved key  →  _elem VSN
            // ─────────────────────────────────────────────────────────────
            // if (nonReservedKeys.length === 1) {
            //     const tagKey = nonReservedKeys[0]!;
            //     const payload = obj[tagKey] as JsonType;

            //     // Build element's children (its own content)
            //     let elementChildren: HsonNode[] = [];

            //     // Path A: explicit VSN container { _elem: [...] } for the element’s content
            //     const payloadObj =
            //         (payload && typeof payload === "object" && !Array.isArray(payload))
            //             ? (payload as Record<string, unknown>)
            //             : undefined;

            //     if (payloadObj && Array.isArray(payloadObj[ELEM_TAG])) {
            //         const list = payloadObj[ELEM_TAG] as JsonType[];
            //         elementChildren = list.map(item => nodeFromJson(item, getTag(item)).node);
            //     }
            //     else if (payload !== undefined && payload !== "") {
            //         // Path B: generic payload → single child for this element
            //         const child = nodeFromJson(payload, getTag(payload)).node;
            //         elementChildren = [child];
            //     }
            //     // else: missing/void payload → empty elementChildren

            //     // The actual element node (attrs/meta belong here)
            //     const elementNode = NEW_NEW_NODE({
            //         _tag: tagKey,
            //         _attrs: objAttrs,
            //         _meta: objMeta,
            //         _content: elementChildren,
            //     });

            //     // ALWAYS WRAP element in an _elem cluster VSN (even if single or empty)
            //     return {
            //         node: NEW_NEW_NODE({
            //             _tag: ELEM_TAG,
            //             _content: [elementNode],
            //         }),
            //     };
            // }

            // ─────────────────────────────────────────────────────────────
            // GENERIC OBJECT: zero or many non-reserved keys  →  _obj VSN
            // ─────────────────────────────────────────────────────────────
            const propertyNodes: HsonNode[] = nonReservedKeys.map(key => {
                const raw: JsonType = obj[key] as JsonType;

                // build the node for the raw value
                const built = nodeFromJson(raw, getTag(raw)).node;

                // CHANGE: enforce JSON “always-wrap” under properties for scalars
                // - If the child is a scalar (_str or _val), wrap it in an _obj VSN.
                // - Arrays and objects keep their own container (_arr / _obj).
                const child: HsonNode =
                    (built._tag === STR_TAG || built._tag === VAL_TAG)
                        ? NEW_NEW_NODE({
                            _tag: OBJ_TAG,          // NEW wrapper
                            _content: [built],      // scalar sits inside this _obj
                        })
                        : built;

                // property node always has a single child in content[0]
                return NEW_NEW_NODE({
                    _tag: key,
                    _content: [child],
                });
            });

            return {
                node: NEW_NEW_NODE({
                    _tag: OBJ_TAG,
                    _content: propertyNodes,  // properties are the cluster
                }),
            };
        }
    }

    /* error fallback */
    _throw_transform_err("recurse_json_for_node: unhandled tag:", "parse_json", make_string($srcJson));
}

/* --- main exported function; parses the JSON (if string) and sends in to loop --- */
export function parse_json($input: string | JsonType): HsonNode {
    let parsed: JsonType;
    try {
        parsed = typeof $input === "string" ? JSON.parse($input) : $input;
    } catch (e) {
        _throw_transform_err(`invalid JSON input ${make_string($input)}`, "parse-json", String(e));
    }

    // Optional unwrap of {_root: ... , _meta?: {...}}.
    let jsonToProcess: JsonType = parsed;
    let rootMeta: HsonMeta | undefined;

    if (is_Object(parsed)) {
        const obj = parsed as JsonObj;
        const keys = Object.keys(obj).filter(k => k !== "_meta");
        if (keys.length === 1 && keys[0] === ROOT_TAG) {
            jsonToProcess = obj[ROOT_TAG] as JsonType;
            // keep meta but only data-_*
            if (obj._meta && is_Object(obj._meta)) {
                const filtered: HsonMeta = {};
                for (const [k, v] of Object.entries(obj._meta)) {
                    if (k.startsWith(_META_DATA_PREFIX)) (filtered as any)[k] = v;
                }
                if (Object.keys(filtered).length) rootMeta = filtered;
            }
            // NOTE: ignore any _attrs on the wrapper; VSNs must not carry _attrs
        }
    }

    // Recurse with _root as the parent context.
    const { node } = nodeFromJson(jsonToProcess, getTag(jsonToProcess));
    const root = NEW_NEW_NODE({
        _tag: ROOT_TAG,
        _meta: rootMeta,
        _content: [node],
    });
    assert_invariants_NEW(root);
    return root;
}