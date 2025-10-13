// parse-json.transform.hson.ts

import { HsonNode, Primitive } from "../..";
import { is_Primitive, is_Object, is_not_string, is_string } from "../../core/utils/guards.core.utils";
import { VAL_TAG, STR_TAG, ARR_TAG, OBJ_TAG, EVERY_VSN, II_TAG, ELEM_TAG, ROOT_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { _DATA_INDEX, _META_DATA_PREFIX } from "../../types-consts/constants";
import { JsonType, HsonMeta, JsonObj, HsonAttrs } from "../../types-consts/node.new.types";
import { assert_invariants } from "../../utils/assert-invariants.utils";
import { _snip } from "../../utils/snip.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
import { make_string } from "../../utils/make-string.utils";
import { is_string_NEW } from "../../utils/node-guards.new.utils";



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

    _throw_transform_err('invalid value provided', 'getTag', '???');
}



const FORBIDDEN_JSON_VSN = new Set([
    '_obj', '_arr', '_ii', '_str', '_val',
]); // _attrs is HTML-source only

function firstNonUnderscoreKey(obj: Record<string, unknown>): string | undefined {
    return Object.keys(obj).find(k => !k.startsWith('_'));
}

function nonUnderscoreKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj).filter(k => !k.startsWith('_'));
}

function assertNoForbiddenVSNKeysInJSON(obj: Record<string, unknown>, where: string) {
    for (const k of Object.keys(obj)) {
        if (FORBIDDEN_JSON_VSN.has(k)) {
            _throw_transform_err(
                `JSON input must not contain "${k}" (reserved for HSON/HTML)`,
                'parse_json',
                `${where}\n${make_string(obj)}`
            );
        }
    }
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
export function nodeFromJson(
    $srcJson: JsonType,
    $parentTag: string
): { node: HsonNode } {

    // ---- 0) Primitive branch (strings → _str, others → _val) ----
    if ($parentTag === STR_TAG || $parentTag === VAL_TAG) {
        if (!is_Primitive($srcJson)) {
            _throw_transform_err('primitive expected (string|number|boolean|null)', 'parse_json', make_string($srcJson));
        }
        if (typeof $srcJson === 'string') {
            return { node: CREATE_NODE({ _tag: STR_TAG, _content: [$srcJson] }) };
        }
        return { node: CREATE_NODE({ _tag: VAL_TAG, _content: [$srcJson as Primitive] }) };
    }

    // ---- 1) Array branch (_arr → _ii[data-_index]) ----
    if ($parentTag === ARR_TAG) {
        if (!Array.isArray($srcJson)) {
            _throw_transform_err('array expected for ARR_TAG parent', 'parse_json', make_string($srcJson));
        }
        const items = ($srcJson as JsonType[]).map((val, ix) => {
            const childTag = getTag(val);
            const child = nodeFromJson(val, childTag).node;
            return CREATE_NODE({
                _tag: II_TAG,
                _meta: { 'data-_index': String(ix) },
                _content: [child]
            });
        });
        return { node: CREATE_NODE({ _tag: ARR_TAG, _content: items }) };
    }

    // ---- 2) Object branch (three mutually exclusive shapes) ----
    if ($parentTag === OBJ_TAG) {
        if (!$srcJson || typeof $srcJson !== 'object' || Array.isArray($srcJson)) {
            _throw_transform_err('object expected for OBJ_TAG parent', 'parse_json', make_string($srcJson));
        }
        const obj = $srcJson as Record<string, unknown>;

        // A) HARD-CODED ROOT: { _root: <cluster-or-primitive> } (exclusive)
        if (Object.prototype.hasOwnProperty.call(obj, ROOT_TAG)) {
            // No other non-underscore siblings allowed
            const nonUS = nonUnderscoreKeys(obj);
            if (!(nonUS.length === 0 || (nonUS.length === 1 && nonUS[0] === ROOT_TAG))) {
                _throw_transform_err('"_root" object must not have non-underscore siblings', 'parse_json', make_string(obj));
            }
            // Parse the root payload
            const rootPayload = obj[ROOT_TAG] as JsonType;
            if (rootPayload === undefined) {
                // Empty _root (allowed) → no children
                return { node: CREATE_NODE({ _tag: ROOT_TAG, _content: [] }) };
            }
            const childTag = getTag(rootPayload);
            const child = nodeFromJson(rootPayload, childTag).node;

            // Enforce: _root child must be a cluster (_obj|_arr|_elem). If scalar, coerce to _elem wrapper.
            const isScalar = (child._tag === STR_TAG || child._tag === VAL_TAG);
            const clusterChild = isScalar
                ? CREATE_NODE({ _tag: ELEM_TAG, _content: [child] })
                : child;

            return { node: CREATE_NODE({ _tag: ROOT_TAG, _content: [clusterChild] }) };
        }

        // B) ELEMENT HANDLING { _elem: [...] } 
        if (Object.prototype.hasOwnProperty.call(obj, ELEM_TAG)) {

            const list = obj[ELEM_TAG];
            if (!Array.isArray(list)) {
                _throw_transform_err('"_elem" must contain an array', 'parse_json', make_string(list));
            }

            // _attrs is HTML-source only: disallow in JSON element-objects
            const children: HsonNode[] = (list as JsonType[]).map((val, ix) => {
                // string → _str, number|boolean|null → _val
                if (is_string(val)) { return CREATE_NODE({ _tag: STR_TAG, _content: [val] }); }
                if (is_Primitive(val)) {
                    return CREATE_NODE({ _tag: VAL_TAG, _content: [val as Primitive] });
                }

                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    const elObj = val as Record<string, unknown>;

                    // Forbid raw HSON/HTML-only keys in JSON element-objects
                    assertNoForbiddenVSNKeysInJSON(elObj, `"_elem"[${ix}]`);

                    // Exactly one non-underscore tag key required
                    const tagKeys = nonUnderscoreKeys(elObj);
                    if (tagKeys.length !== 1) {
                        _throw_transform_err('element-object must have exactly one tag key', 'parse_json', make_string(elObj));
                    }

                    const tagName = tagKeys[0];
                    const rawChildren = elObj[tagName] as JsonType;

                    // Build the tag’s children (0..1 child node). Scalars and clusters both allowed.
                    let tagKids: HsonNode[] = [];
                    if (rawChildren !== undefined) {
                        const kidTag = getTag(rawChildren);
                        const kidNode = nodeFromJson(rawChildren, kidTag).node;
                        tagKids = [kidNode];
                    }

                    // Assemble the element node (no _attrs in JSON)
                    return CREATE_NODE({ _tag: tagName, _content: tagKids });
                }

                _throw_transform_err(
                    `invalid item in [${ix}] (must be string|number|boolean|null or element-object)`,
                    'parse_json',
                    make_string(val)
                );
            });

            return { node: CREATE_NODE({ _tag: ELEM_TAG, _content: children }) };
        }

        // C) GENERIC OBJECT HANDLING → _obj
        assertNoForbiddenVSNKeysInJSON(obj, '[generic object check, parseJSON]');
        const propKeys = Object.keys(obj);

        const propertyNodes: HsonNode[] = propKeys.map((key) => {
            const raw = obj[key] as JsonType;

            // Treat explicit empty-string as a void property node (no child)
            if (raw === '') {
                return CREATE_NODE({ _tag: key, _content: [] });
            }

            const childTag = getTag(raw);
            const built = nodeFromJson(raw, childTag).node;

            // Scalar children get wrapped once in an _obj cluster
            const child =
                (built._tag === STR_TAG || built._tag === VAL_TAG)
                    ? CREATE_NODE({ _tag: OBJ_TAG, _content: [built] })
                    : built;

            return CREATE_NODE({ _tag: key, _content: [child] });
        });

        return { node: CREATE_NODE({ _tag: OBJ_TAG, _content: propertyNodes }) };
    }

    // ---- 3) Fallback guard (parentTag/value mismatch) ----
    _throw_transform_err(
        `unhandled branch: parentTag=${$parentTag}`,
        'parse_json',
        make_string($srcJson)
    );
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
    const root = CREATE_NODE({
        _tag: ROOT_TAG,
        _meta: rootMeta,
        _content: [node],
    });
    assert_invariants(root, 'root');
    
    return root;
}