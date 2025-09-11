// parse-json.transform.hson.ts

import {  HsonNode, Primitive } from "../..";
import { is_Primitive, is_Object } from "../../core/utils/guards.core.utils";
import { VAL_TAG, STR_TAG, ARR_TAG, OBJ_TAG, EVERY_VSN, II_TAG, ELEM_TAG, ROOT_TAG } from "../../types-consts/constants";
import { NEW_NEW_NODE } from "../../types-consts/factories";
import { _DATA_INDEX, _META_DATA_PREFIX } from "../../types-consts/constants";
import { JsonType, HsonMeta, JsonObj, HsonAttrs } from "../../types-consts/node.new.types";
import { assert_invariants_NEW } from "../../utils/assert-invariants.utils";
import { is_not_string_NEW } from "../../utils/node-guards.new.utils";
import { _snip } from "../../utils/snip.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";



/* debug log */
let _VERBOSE = true;
const _log: (...args: Parameters<typeof console.log>) => void =
    _VERBOSE
        ? (...args) => console.log(
            '[parse_json_NEW]: ',
            ...args.map(a => (typeof a === "string" ? _snip(a, 500) : a)))   // ← prefix + passthrough
        : () => { };


function getTag($value: JsonType): string {
    if (is_not_string_NEW($value)) return VAL_TAG;
    if (is_Primitive($value)) {
        return STR_TAG;
    }
    if (Array.isArray($value)) {
        return ARR_TAG;
    }
    if (is_Object($value)) {
        return OBJ_TAG;
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
        _throw_transform_err(`unknown VSN-like tag: <${$parentTag}>`, 'parse-html');
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
        const jsonObj = $srcJson as JsonObj;
        let objMeta: HsonMeta = jsonObj._meta || {};
        let objAttrs: HsonAttrs = jsonObj._attrs || {};

        const jsonKeys = Object.keys(jsonObj).filter(k => k !== '_meta');

        /* case 1: _elem wrapper  */
        if (jsonKeys[0] === ELEM_TAG) {
            if (jsonKeys.length > 1) console.error('content of parent of _elem tag is too long (_elem has siblings!)')
            const listContent = jsonObj[ELEM_TAG];
            if (Array.isArray(listContent)) {
                const contentNodes: HsonNode[] = listContent.map(item => {
                    const recursedItem = nodeFromJson(item as JsonType, getTag(item as JsonType));
                    if (recursedItem.node._tag === OBJ_TAG && recursedItem.node._content.length === 1) {
                        const singleProperty = recursedItem.node._content[0] as HsonNode;
                        singleProperty._meta = singleProperty._meta || {};
                        singleProperty._attrs = singleProperty._attrs || {};
                        return singleProperty;
                    }
                    return recursedItem.node;
                });

                return {
                    node: NEW_NEW_NODE({ _tag: ELEM_TAG, _content: contentNodes }),
                };
            } else {
                _throw_transform_err('content must always be in an array', 'parse_json');
            }
        }

        /* _obj case 2 (Default): ALL other JSON objects become an _obj VSN. */
        else {
            // 1) strip reserved keys off the object
            const { _attrs: objAttrs, _meta: objMeta, ...rest } = jsonObj as Record<string, unknown>;
            const jsonKeys = Object.keys(rest); // no _attrs/_meta here

            // 2) build properties from non-reserved keys only
            const propertyNodes: HsonNode[] = jsonKeys.map(key => {
                const propertyValues = rest[key] as JsonType;

                // void property → empty content; DO NOT attach objAttrs/objMeta here
                if (propertyValues === "") {
                    return NEW_NEW_NODE({
                        _tag: key,
                        _content: [],            // keep void
                        // _attrs: objAttrs,      // removed
                        // _meta: objMeta,        // removed
                    });
                }

                // recurse for non-void
                const recursed = nodeFromJson(propertyValues, getTag(propertyValues));
                let valueNode = NEW_NEW_NODE();

                if (recursed.node._tag === STR_TAG || recursed.node._tag === VAL_TAG) {
                    valueNode = NEW_NEW_NODE({ _tag: OBJ_TAG, _content: [recursed.node] });
                } else {
                    valueNode = recursed.node;
                }

                return NEW_NEW_NODE({
                    _tag: key,
                    _content: [valueNode],
                    // do not spread objAttrs/meta into children in this generic _obj mapping
                });
            });

            // 3) wrap as _obj
            return {
                node: NEW_NEW_NODE({
                    _tag: OBJ_TAG,
                    _content: propertyNodes,
                }),
            };
        }
    }

    /* error fallback */
    _throw_transform_err("recurse_json_for_node: unhandled tag:", "parse_json", $parentTag);
}

/* --- main exported function; parses the JSON (if string) and sends in to loop --- */
export function parse_json($input: string | JsonType): HsonNode {
    let parsed: JsonType;
    try {
        parsed = typeof $input === "string" ? JSON.parse($input) : $input;
    } catch (e) {
        _throw_transform_err("invalid JSON input", "parse-json", String(e));
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