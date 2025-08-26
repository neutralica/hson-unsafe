// parse-json.transform.hson.ts

import { Primitive } from "../../../core/types-consts/core.types.hson";
import { is_Object, is_Primitive } from "../../../core/utils/guards.core.utils.hson";
import {ARR_TAG, ELEM_TAG, II_TAG, OBJ_TAG, ROOT_TAG, STR_TAG, VAL_TAG}from "../../../types-consts/constants.hson"
import { snip_long_string } from "../../../utils/preview-long.utils.hson";
import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson";
import { NEW_NEW_NODE } from "../../types-consts/constants.new.hson";
import { JsonType_NEW, HsonNode_NEW, HsonMeta_NEW, JsonObj_NEW, HsonAttrs_NEW } from "../../types-consts/node.new.types.hson";
import { is_not_string_NEW } from "../../utils/node-guards.new.utils.hson";



/* debug log */
let _VERBOSE = false;
const _log: (...args: Parameters<typeof console.log>) => void =
    _VERBOSE
        ? (...args) => console.log(
            '[parse_json_NEW]: ',
            ...args.map(a => (typeof a === "string" ? snip_long_string(a, 500) : a)))   // ← prefix + passthrough
        : () => { };


function getTag($value: JsonType_NEW): string {
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
 * @param {string | JsonType_NEW} $srcJson - the json data to parse, either as a raw string or a pre-parsed javascript object/array.
 * @param {string} $parentTag - the parent tag, usually necessary for determining which VSN to create 
 * @returns {HsonNode_NEW} the root hsonnode of the resulting data structure.
 */

function nodeFromJson(
    $srcJson: JsonType_NEW,
    $parentTag: string
): { node: HsonNode_NEW } {

    /* catch primitive nodes */
    if ($parentTag === STR_TAG || $parentTag === VAL_TAG) {
        if (!is_Primitive($srcJson)) {
            _throw_transform_err('values must be string, bool, number, or null', 'parse_json', $srcJson);
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
        const array = $srcJson as JsonType_NEW[];
        const items: HsonNode_NEW[] = array.map((val, ix) => {
            const itemStructuralTag = getTag(val);
            const itemConversion = nodeFromJson(val, itemStructuralTag);

            let dataIx: HsonMeta_NEW = { "data-index": String(ix) };

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
        const jsonObj = $srcJson as JsonObj_NEW;
        let objMeta: HsonMeta_NEW = jsonObj._meta || {};
        let objAttrs: HsonAttrs_NEW = jsonObj._attrs || {};

        const jsonKeys = Object.keys(jsonObj).filter(k => k !== '_meta');

        /* case 1: _elem wrapper  */
        if (jsonKeys[0] === ELEM_TAG) {
            if (jsonKeys.length > 1) console.error('content of parent of _elem tag is too long (_elem has siblings!)')
            const listContent = jsonObj[ELEM_TAG];
            if (Array.isArray(listContent)) {
                const contentNodes: HsonNode_NEW[] = listContent.map(item => {
                    const recursedItem = nodeFromJson(item as JsonType_NEW, getTag(item as JsonType_NEW));
                    if (recursedItem.node._tag === OBJ_TAG && recursedItem.node._content.length === 1) {
                        const singleProperty = recursedItem.node._content[0] as HsonNode_NEW;
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
                _throw_transform_err('content must always be in an array', 'parse_json', $srcJson)
            }
        }

        /* _obj case 2 (Default): ALL other JSON objects become an _obj VSN. */
        else {
            /* handle void nodes/nodes with no content */
            const propertyNodes: HsonNode_NEW[] = jsonKeys.map(key => {
                const propertyValues = jsonObj[key] as JsonType_NEW;
                if (propertyValues === "" || propertyValues === '') {
                    return NEW_NEW_NODE({
                        _tag: key,
                        _content: [],
                        _meta: objMeta,
                        _attrs: objAttrs,
                    });
                }

                /*  for other properties (including non-void tags with "" value):
                      process the value recursively to get its HsonNode representation (_obj, _array, or #text). */
                const recursedProps = nodeFromJson(propertyValues, getTag(propertyValues));

                let finalNode = NEW_NEW_NODE();
                /* check for BasicValue node */
                if (recursedProps.node._tag === STR_TAG || recursedProps.node._tag === VAL_TAG) {
                    /* wrap it in an _obj VSN */
                    if (recursedProps.node._content)
                        finalNode = NEW_NEW_NODE({
                            _tag: OBJ_TAG,
                            _content: [recursedProps.node],
                        });
                } else {
                    /* if the value was already an object or array, its HsonNode is already a VSN (_obj or _array)
                         use it directly as the content */
                    finalNode = recursedProps.node;
                }

                /* create the base node */
                return NEW_NEW_NODE({
                    _tag: key,
                    _content: [finalNode],
                    _meta: objMeta
                });
            });

            /* wrap in _obj VSN & return */
            return {
                node: NEW_NEW_NODE({
                    _tag: OBJ_TAG,
                    _content: propertyNodes,
                })
            };
        }
    }

    /* error fallback */
    _throw_transform_err("recurse_json_for_node: unhandled tag:", "parse_json", $parentTag);
}

/* --- main exported function; parses the JSON (if string) and sends in to loop --- */
export function parse_json_NEW($input: string): HsonNode_NEW {
    if (_VERBOSE) {
        console.groupCollapsed('---> parsing json:');
        console.log($input);
        console.groupEnd();
    }
    let parsedJson: JsonType_NEW;
    /* accept either string or JSON */
    if (typeof $input === 'string') {
        try {
            parsedJson = JSON.parse($input);
        } catch (error) {
            console.error('JSON parse error in json_to_node:', error);
            const errMsg = error instanceof Error ? error.message : "unknown parsing error";
            _throw_transform_err(`invalid JSON input: ${errMsg}`, 'parse_json', $input);
        }
    } else if (typeof $input === 'object' && $input !== null) {
        parsedJson = $input as JsonType_NEW;
    } else {
        console.error('JSON input is not a string or object --\n received: ', typeof $input);
        _throw_transform_err('Iinput must be a valid JSON string or a JavaScript object', 'parse_json', $input);
    }

    let jsonToProcess: JsonType_NEW = parsedJson;
    let finalMeta: HsonMeta_NEW | undefined = undefined;
    let finalAttrs: HsonMeta_NEW | undefined = undefined;
    /* check if the top-level parsed JSON is an object whose actual data content
         is nested under a VSN key (typically "_root"),
         and also check for a sibling _meta at this level */
    if (is_Object(parsedJson)) {
        const jsonKeys = Object.keys(parsedJson);
        const jsonProperties = jsonKeys.filter(k => k !== '_meta');

        if (jsonProperties.length === 1 && jsonProperties[0] === ROOT_TAG) {
            if ((parsedJson as  JsonObj_NEW)._meta) {
                finalMeta = (parsedJson as  JsonObj_NEW)._meta;
            }
            jsonToProcess = (parsedJson as  JsonObj_NEW)[ROOT_TAG]; /*  "unwrap" it */
        }
        // else if ((parsedJson as JSONObject)._meta) {
        // }
    }

    const topTag = getTag(jsonToProcess);
    const recursedNodes = nodeFromJson(jsonToProcess, topTag);

    /* wrap in _root */
    const finalNode = NEW_NEW_NODE({
        _tag: ROOT_TAG,
        _content: [recursedNodes.node],
    });
    if (_VERBOSE) {
        console.groupCollapsed(' returning finalNode:');
        console.log(finalNode);
        console.groupEnd();
    }
    return finalNode;
}