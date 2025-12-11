// parse-json.transform.hson.ts

import { is_Primitive, is_Object, is_string } from "../../core/utils/guards.core.utils";
import { VAL_TAG, STR_TAG, ARR_TAG, OBJ_TAG,  II_TAG, ELEM_TAG, ROOT_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { _DATA_INDEX, _META_DATA_PREFIX } from "../../types-consts/constants";
import { HsonMeta,  HsonAttrs, HsonNode } from "../../types-consts/node.types";
import { JsonObj, JsonValue, Primitive } from "../../core/types-consts/core.types";
import { assert_invariants } from "../../diagnostics/assert-invariants.utils";
import { _snip } from "../../utils/sys-utils/snip.utils";
import { make_string } from "../../utils/primitive-utils/make-string.nodes.utils";
import { parse_style_string } from "../../utils/attrs-utils/parse-style";
import { serialize_style } from "../../utils/attrs-utils/serialize-style";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";



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

function getTag($value: JsonValue): string {
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
 * @param {string | JsonValue} $srcJson - the json data to parse, either as a raw string or a pre-parsed javascript object/array.
 * @param {string} $parentTag - the parent tag, usually necessary for determining which VSN to create 
 * @returns {HsonNode} the root hsonnode of the resulting data structure.
 */
export function nodeFromJson(
    $srcJson: JsonValue,
    $parentTag: string
): { node: HsonNode } {

    // ---- 0) Primitive branch (strings → _str, others → _val) ----
    if ($parentTag === STR_TAG || $parentTag === VAL_TAG) {
        // preserve empty-string as a real scalar (_str([""]))
        if ($parentTag === STR_TAG) {
            if (!is_string($srcJson)) {
                _throw_transform_err(`expected string for ${STR_TAG}, got ${typeof $srcJson}`, 'nodeFromJson.primitive');
            }
            return {
                node: CREATE_NODE({
                    _tag: STR_TAG,
                    _meta: {},
                    _content: [$srcJson] // "" included
                })
            };
        } else { // VAL_TAG
            if (!is_Primitive($srcJson)) {
                _throw_transform_err(`expected number|boolean|null for ${VAL_TAG}, got ${typeof $srcJson}`, 'nodeFromJson.primitive');
            }
            return {
                node: CREATE_NODE({
                    _tag: VAL_TAG,
                    _meta: {},
                    _content: [$srcJson] // null/number/boolean
                })
            };
        }
    }

    // ---- 1) Array branch (_arr → _ii[data-_index]) ----
    if ($parentTag === ARR_TAG) {
        if (!Array.isArray($srcJson)) {
            _throw_transform_err('array expected for ARR_TAG parent', 'parse_json', make_string($srcJson));
        }
        const items = ($srcJson as JsonValue[]).map((val, ix) => {
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
            const rootPayload = obj[ROOT_TAG] as JsonValue;
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

            const children: HsonNode[] = (list as JsonValue[]).map((val, ix) => {
                // string → _str, number|boolean|null → _val
                if (is_string(val)) {
                    return CREATE_NODE({ _tag: STR_TAG, _meta: {}, _content: [val] });
                }
                if (is_Primitive(val)) {
                    return CREATE_NODE({ _tag: VAL_TAG, _meta: {}, _content: [val as Primitive] });
                }

                // object → element-object (allow _attrs/_meta; preserve them)
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    const elObj = val as Record<string, unknown>;

                    // guard against raw VSN misuse
                    assertNoForbiddenVSNKeysInJSON(elObj, `"_elem"[${ix}]`);

                    // Exactly one non-underscore tag key required
                    const tagKeys = nonUnderscoreKeys(elObj);
                    if (tagKeys.length !== 1) {
                        _throw_transform_err('element-object must have exactly one tag key', 'parse_json', make_string(elObj));
                    }

                    const tagName = tagKeys[0];

                    // hoist attributes/meta if present
                    const maybeAttrs = elObj['_attrs'];
                    const maybeMeta = elObj['_meta'];
                    const hoistedAttrs = (maybeAttrs && typeof maybeAttrs === 'object' && !Array.isArray(maybeAttrs))
                        ? (maybeAttrs as HsonAttrs)
                        : undefined;
                    const hoistedMeta = (maybeMeta && typeof maybeMeta === 'object' && !Array.isArray(maybeMeta))
                        ? (maybeMeta as HsonMeta)
                        : undefined;

                    if (hoistedAttrs && Object.prototype.hasOwnProperty.call(hoistedAttrs, "style")) {
                        const sv = (hoistedAttrs as any).style;

                        if (sv && typeof sv === "object" && !Array.isArray(sv)) {
                            // JSON gave a style object ⇒ canonicalize 
                            const css = serialize_style(sv as Record<string, string>);      // kebab/trim/sort
                            (hoistedAttrs as any).style = parse_style_string(css);        // lower→camel done here
                        } else if (typeof sv === "string") {
                            // JSON gave style as text ⇒ parse to canonical object
                            (hoistedAttrs as any).style = parse_style_string(sv);
                        } else {
                            // null/undefined ⇒ drop
                            delete (hoistedAttrs as any).style;
                        }
                    }

                    // Build the tag’s child (0..1) from the tag payload (scalar or cluster)
                    const rawChildren = elObj[tagName] as JsonValue;
                    let tagKids: HsonNode[] = [];
                    if (rawChildren !== undefined) {
                        const kidTag = getTag(rawChildren);
                        const kidNode = nodeFromJson(rawChildren, kidTag).node;
                        tagKids = [kidNode];
                    }

                    const elemNode = CREATE_NODE( { _tag: tagName, _content: tagKids });
                    if (hoistedAttrs && Object.keys(hoistedAttrs).length) elemNode._attrs = hoistedAttrs;  // ← preserve
                    if (hoistedMeta && Object.keys(hoistedMeta).length) elemNode._meta = { ...elemNode._meta, ...hoistedMeta };

                    return elemNode;
                }

                _throw_transform_err(
                    `invalid item in "_elem"[${ix}] (must be string|number|boolean/null or element-object)`,
                    'parse_json',
                    make_string(val)
                );
            });

            return { node: CREATE_NODE({ _tag: ELEM_TAG, _meta: {}, _content: children }) };

        }

        // C) GENERIC OBJECT HANDLING → _obj
        assertNoForbiddenVSNKeysInJSON(obj, '[generic object check, parseJSON]');
        const propKeys = Object.keys(obj);

        const propertyNodes: HsonNode[] = propKeys.map((key) => {
            const raw = obj[key] as JsonValue;

            // build a child node for the property value WITHOUT collapsing "".
            let child: HsonNode;

            if (typeof raw === 'string') {
                // strings (including "") → _str(["..."])
                child = CREATE_NODE({
                    _tag: STR_TAG,
                    _meta: {},
                    _content: [raw] // "" preserved
                });
            } else if (
                typeof raw === 'number' ||
                typeof raw === 'boolean' ||
                raw === null
            ) {
                // numbers/booleans/null → _val([...])
                child = CREATE_NODE({
                    _tag: VAL_TAG,
                    _meta: {},
                    _content: [raw]
                });
            } else if (Array.isArray(raw)) {
                // arrays recurse under _arr
                child = nodeFromJson(raw, ARR_TAG).node;
            } else if (raw && typeof raw === 'object') {
                // objects recurse under _obj
                child = nodeFromJson(raw, OBJ_TAG).node;
            } else {
                _throw_transform_err(`unsupported JSON value for key "${key}"`, 'nodeFromJson.object.value');
            }

            // JSON-mode property ⇒ inner _obj wrapper unless the child is already a cluster
            const payload =
                (child._tag === OBJ_TAG || child._tag === ARR_TAG)
                    ? [child]                                    // passthrough single cluster
                    : [CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [child] })]; // wrap leaf in _obj

            return CREATE_NODE({
                _tag: key,
                _meta: {},
                _content: payload
            });
        });

        return {
            node: CREATE_NODE({
                _tag: OBJ_TAG,
                _meta: {},
                _content: propertyNodes
            })
        };
    }

    // ---- Fallback (should be unreachable if callers set parentTag correctly) ----
    _throw_transform_err(`unhandled parentTag ${$parentTag}`, 'nodeFromJson.dispatch');
}


/* --- main exported function; parses the JSON (if string) and sends in to loop --- */

export function parse_json($input: string | JsonValue): HsonNode {
  let parsed: JsonValue;
  try {
    parsed = typeof $input === "string" ? JSON.parse($input) : $input;
  } catch (e) {
    _throw_transform_err(`invalid JSON input ${make_string($input)}`, "parse-json", String(e));
  }

  // unwrap legacy {_root: ...} but keep data-* meta (unchanged)
  let jsonToProcess: JsonValue = parsed;
  let rootMeta: HsonMeta | undefined;
  if (is_Object(parsed)) {
    const obj = parsed as JsonObj;
    const keys = Object.keys(obj).filter(k => k !== "_meta");
    if (keys.length === 1 && keys[0] === ROOT_TAG) {
      jsonToProcess = obj[ROOT_TAG] as JsonValue;
      if (obj._meta && is_Object(obj._meta)) {
        const filtered: HsonMeta = {};
        for (const [k, v] of Object.entries(obj._meta)) {
          if (k.startsWith(_META_DATA_PREFIX)) (filtered as any)[k] = v;
        }
        if (Object.keys(filtered).length) rootMeta = filtered;
      }
    }
  }

  
  // ------------------------------------------------------------------------------

  const { node } = nodeFromJson(jsonToProcess, getTag(jsonToProcess));
  const root = CREATE_NODE({
    _tag: ROOT_TAG,
    _meta: rootMeta,
    _content: [node],
  });
  assert_invariants(root, "root");
  return root;
}