// parse-json.transform.hson.ts

import { JSONShape, HsonNode, BasicValue, _Meta, JSONObject } from "../../types-consts/types.hson.js";
import { PRIM_TAG, STRING_TAG, ARRAY_TAG, OBJECT_TAG, NEW_NODE, BLANK_META, INDEX_TAG, ELEM_TAG, ROOT_TAG } from "../../types-consts/constants.hson.js";
import { is_not_string, is_Object, is_BasicValue } from "../../utils/is-helpers.utils.hson.js";

/* debug log */
let _VERBOSE = false;
const $log = _VERBOSE
    ? console.log
    : () => { };


function getTag(value: JSONShape): string {
    if (is_not_string(value)) return PRIM_TAG;
    if (is_BasicValue(value)) {
        return STRING_TAG;
    }
    if (Array.isArray(value)) {
        return ARRAY_TAG;
    }
    return OBJECT_TAG; /* default (but feels like a big waiting to happen) */
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
 * @param {string | JSONShape} $srcJson - the json data to parse, either as a raw string or a pre-parsed javascript object/array.
 * @param {string | JSONShape} $parentTag - the parent tag, usually necessary for determining which VSN to create 
 * @returns {HsonNode} the root hsonnode of the resulting data structure.
 */

function nodeFromJson(
    $srcJson: JSONShape,
    $parentTag: string
): { node: HsonNode } {

    /* catch BasicValue nodes */
    if ($parentTag === STRING_TAG || $parentTag === PRIM_TAG) {
        if (!is_BasicValue($srcJson)) {
            console.error('value is not primitive')
        }
        if (is_not_string($srcJson)) {
            return {
                node: NEW_NODE({
                    tag: PRIM_TAG,
                    content: [$srcJson as BasicValue],
                }),
            };
        } else {
            const node = NEW_NODE({
                tag: STRING_TAG,
                content: [$srcJson as BasicValue],
            });
            return { node };
        }
    }

    /*  arrays -> _array VSN */
    if ($parentTag === ARRAY_TAG) {
        const array = $srcJson as JSONShape[];
        const items: HsonNode[] = array.map((val, ix) => {
            const itemStructuralTag = getTag(val);
            const itemConversion = nodeFromJson(val, itemStructuralTag);

            let dataIx: _Meta = { attrs: { "data-index": String(ix) }, flags: [] };

            return NEW_NODE({
                tag: INDEX_TAG, /* <_ii> wrapper */
                content: [itemConversion.node], /* the item itself */
                _meta: dataIx
            });
        });
        return {
            node: NEW_NODE({
                tag: ARRAY_TAG,
                content: items,
            }),
        };
    }

    /* catch objects */
    if ($parentTag === OBJECT_TAG) {
        const jsonObj = $srcJson as JSONObject;
        let objMeta: _Meta | undefined = undefined;

        if (jsonObj._meta) {
            const sourceMeta = jsonObj._meta;
            objMeta = {
                attrs: { ...(sourceMeta.attrs || {}) },
                flags: [...(sourceMeta.flags || [])],
            };
        }

        const jsonKeys = Object.keys(jsonObj).filter(k => k !== '_meta');

        /* case 1: _elem wrapper  */
        if (jsonKeys[0] === ELEM_TAG) {
            if (jsonKeys.length > 1) console.error('content of parent of _elem tag is too long (_elem has siblings!)')
            const listContent = jsonObj[ELEM_TAG];
            if (Array.isArray(listContent)) {
                const contentNodes: HsonNode[] = listContent.map(item => {
                    const recursedItem = nodeFromJson(item as JSONShape, getTag(item as JSONShape));
                    if (recursedItem.node.tag === OBJECT_TAG && recursedItem.node.content.length === 1) {
                        const singleProperty = recursedItem.node.content[0] as HsonNode;
                        singleProperty._meta = {
                            attrs: { ...singleProperty._meta.attrs || {} },
                            flags: [...singleProperty._meta.flags || []],
                        };
                        return singleProperty;
                    }
                    return recursedItem.node;
                });

                return {
                    node: NEW_NODE({ tag: ELEM_TAG, content: contentNodes }),
                };
            } else { console.error('content should always be array?') }
        }

        /* _obj case 2 (Default): ALL other JSON objects become an _obj VSN. */
        else {
            /* handle void nodes/nodes with no content */
            const propertyNodes: HsonNode[] = jsonKeys.map(key => {
                const propertyValues = jsonObj[key] as JSONShape;
                if (propertyValues === "" || propertyValues === '') {
                    return NEW_NODE({
                        tag: key,
                        content: [],
                        _meta: objMeta
                    });
                }

                /*  for other properties (including non-void tags with "" value):
                      process the value recursively to get its HsonNode representation (_obj, _array, or #text). */
                const recursedProps = nodeFromJson(propertyValues, getTag(propertyValues));

                let finalNode = NEW_NODE();
                /* check for BasicValue node */
                if (recursedProps.node.tag === STRING_TAG || recursedProps.node.tag === PRIM_TAG) {
                    /* wrap it in an _obj VSN */
                    if (recursedProps.node.content)
                        finalNode = NEW_NODE({
                            tag: OBJECT_TAG,
                            content: [recursedProps.node],
                        });
                } else {
                    /* if the value was already an object or array, its HsonNode is already a VSN (_obj or _array)
                         use it directly as the content */
                    finalNode = recursedProps.node;
                }

                /* create the base node */
                return NEW_NODE({
                    tag: key,
                    content: [finalNode],
                    _meta: objMeta
                });
            });

            /* wrap in _obj VSN & return */
            return {
                node: NEW_NODE({
                    tag: OBJECT_TAG,
                    content: propertyNodes,
                })
            };
        }
    }

    /* error fallback */
    console.error("recurse_json_for_node: unhandled tag:", $parentTag);
    return {
        node: NEW_NODE({ tag: "ERROR_UNHANDLED_TYPE", content: [String($srcJson) as BasicValue] }),
    };
}

/* --- main exported function; parses the JSON (if string) and sends in to loop --- */
export function parse_json($jstring: string): HsonNode {
    if (_VERBOSE) {
        console.groupCollapsed('---> parsing json:');
        console.log(' input json:');
        console.log($jstring);
        console.groupEnd();
    }
    if (typeof $jstring !== 'string') {
        console.error('JSON input is not a string -- received a ', typeof $jstring);
        return NEW_NODE({
            tag: '[JSON TYPE ERROR]',
            content: [NEW_NODE({ tag: STRING_TAG, content: [`ERROR: INVALID STRING`] })],
        });
    }

    let parsedJson: JSONShape;
    try {
        parsedJson = JSON.parse($jstring);
    } catch (error) {
        console.error('JSON parse error in json_to_node:', error);
        const errMsg = error instanceof Error ? error.message : "Unknown parsing error";
        return NEW_NODE({
            tag: "[JSON PARSE ERROR]",
            content: [NEW_NODE({ tag: STRING_TAG, content: [`Invalid JSON input: ${errMsg}`] })],
        });
    }

    let jsonToProcess: JSONShape = parsedJson;
    let finalMeta: _Meta | undefined = undefined;
    /* check if the top-level parsed JSON is an object whose actual data content
         is nested under a VSN key (typically "_root"),
         and also check for a sibling _meta at this level */
    if (is_Object(parsedJson)) {
        const jsonKeys = Object.keys(parsedJson);
        const jsonProperties = jsonKeys.filter(k => k !== '_meta');

        if (jsonProperties.length === 1 && jsonProperties[0] === ROOT_TAG) {
            if ((parsedJson as JSONObject)._meta) {
                finalMeta = (parsedJson as JSONObject)._meta;
            }
            jsonToProcess = (parsedJson as JSONObject)[ROOT_TAG]; /*  "unwrap" it */
        }
        // else if ((parsedJson as JSONObject)._meta) {
        // }
    }

    const topTag = getTag(jsonToProcess);
    const recursedNodes = nodeFromJson(jsonToProcess, topTag);

    /* wrap in _root */
    const finalNode = NEW_NODE({
        tag: ROOT_TAG,
        content: [recursedNodes.node],
    });
    if (_VERBOSE) {
        console.groupCollapsed(' returning finalNode:');
        console.log(finalNode);
        console.groupEnd();
    }
    return finalNode;
}