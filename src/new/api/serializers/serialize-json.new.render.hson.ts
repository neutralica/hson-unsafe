// serialize-json.render.hson.ts

import { HsonNode, JsonType, JsonObj, Primitive, HsonAttrs, HsonFlags } from "../../types-consts/types.hson.js";
import { ROOT_TAG, ARRAY_TAG, OBJECT_TAG, VAL_TAG, STRING_TAG, ELEM_TAG, INDEX_TAG } from "../../types-consts/constants.hson.js";
import { is_indexed, is_Node } from "../../utils/is-helpers.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils.hson.js";


/* debug log */
let _VERBOSE = false;
const _log = _VERBOSE
    ? console.log
    : () => { };

export function serialize_json($node: HsonNode): string {
    if (_VERBOSE) {
        console.groupCollapsed('---> serializing json');
        console.log('input node:');
        console.log(make_string($node));
        console.groupEnd();
    }
    const serializedJson = jsonFromNode($node);

    try {
        const json = make_string({ [ROOT_TAG]: serializedJson });
        if (_VERBOSE) {
            console.groupCollapsed('returning json:');
            console.log(json);
            console.groupEnd();
        }
        return json;
    } catch (e: any) {

        _throw_transform_err(`error during final JSON.stringify\n ${e.message}`, 'serialize-json', serialize_json);
    }
}

/**
 * recursive splitter runs nodes through until they terminate in a JSON-shaped endpoint, 
 * then returns that after some VSN processing
 *
 * this is the core recursive helper for the `serialize_json` function. it
 * translates the hson node structure, including vsns like '_obj' and '_array',
 * back into its equivalent javascript representation.
 *
 * @param {HsonNode} $node - the hsonnode to convert
 * @returns {JsonType} the resulting javascript object, array, or primitive value
 */

function jsonFromNode($node: HsonNode): JsonType {

    if (!$node || typeof $node._tag !== 'string') {
        _throw_transform_err(`error in node or node tag: ${$node}`, 'serialize_json', $node);
    }


    /* step 1: catch VSNs */
    _log(`NEXT: ${$node._tag}`)

    switch ($node._tag) {
        case ROOT_TAG: {
            let root: JsonType | null = null;
            _log(`  <_root>: processing content`);
            root = jsonFromNode($node._content[0] as HsonNode);
            if (root === null) _throw_transform_err('_root is null', 'serialize_json', $node);
            return root;
        }

        case ARRAY_TAG: {
            _log(`  <_array> tag reached: creating JSON array`);
            _log(make_string($node));
            let array = [];
            if ($node._content) { /*  content of _array node must be _ii nodes */
                for (const iiNode of $node._content as HsonNode[]) {
                    if (is_indexed(iiNode)) {
                        array.push(jsonFromNode(iiNode._content[0] as HsonNode));
                    } else {
                        _throw_transform_err(`malformed _ii node in _array`, 'serialize-json', $node);
                    }
                }
            }
            return array;
        }

        case OBJECT_TAG: {
            /* check if _obj is just a wrapper around a primitive VSN */
            if ($node._content.length === 1) {
                const childNode = $node._content[0] as HsonNode;
                /* if the single child is a _prim or _str, this _obj is just a wrapper
                     unwrap the value directly and return the primitive, ignoring the VSN tags */
                if (childNode._tag === VAL_TAG || childNode._tag === STRING_TAG) {
                    _log(`  <_obj>: unwrapping simple ${typeof childNode._content[0]} value: `, make_string(childNode._content[0]));
                    return jsonFromNode(childNode);
                }
                return jsonFromNode(childNode);
            }

            /* if not, it's an object builder */
            _log(`  <_obj>: constructing JSON object from properties`);
            const properties: JsonObj = {};

            /* get the object's properties--the nodes in its .content */
            for (const prop of ($node._content as HsonNode[])) {
                if (!is_Node(prop) || !prop._tag) {
                    _throw_transform_err(`invalid child inside _obj:${ prop}`, 'serialize_json', $node._content);
                }

                const key = prop._tag;
                let value = null;

                /* the value is property's unwrapped content */
                if (prop._content && prop._content.length > 0) {
                    value = jsonFromNode(prop._content[0] as HsonNode);
                }

                properties[key] = value;
            }
            
            return properties;
        }


        case VAL_TAG: {
            /* return Primitive content directly */
            _log(`  <_prim>: returning number value: ${$node._content[0]}`);
            return $node._content[0] as Primitive;
        }

        case STRING_TAG: {
            /* need to make sure that string_tag content is stringified; a number will be stored un-stringified
                in a string node's content; it is still supposed to be stringified before serializing */
            _log(`  <_str>: returning string value: "${String($node._content[0])}"`);
            const str = (typeof $node._content[0] === 'number') ? String($node._content[0]) : $node._content[0] as Primitive;
            return str;
        }

        case ELEM_TAG: {
            /* _elem tags are native to HTML and will be carried through the JSON as-is; the only 
                exceptional handling is the contents of _elem tags are not rewrapped in an _obj */
            _log('[recurseJSON] processing _elem VSN');
            const elemItems: JsonType = [];
            for (const itemNode of ($node._content)) {
                /* recursively convert each item node in the _elem to its JSON equivalent */
                _log('recursing: ', itemNode)
                const jsonItem = jsonFromNode(itemNode as HsonNode);
                elemItems.push(jsonItem);
                _log('pushing list item to _elem:')
                _log(jsonItem)
            }
            _log('returning list items:', elemItems)
            return { [ELEM_TAG]: elemItems };
        }

        case INDEX_TAG: /* _ii nodes within an array */
            _log('node.tag is index tag');
            /*  these are _array content wrappers; their JSON form is the JSON form of their single content item */
            let iiContent: JsonType = {}
            if ($node._content && $node._content.length === 1) {
                iiContent = jsonFromNode($node._content[0] as HsonNode);
            } else {
                _throw_transform_err(`misconfigured index tag:  make_string($node)`, 'serialize_json', $node._content);
            }
            return iiContent;

        default: { /* "standard" tag (e.g. "foo", "kingdom", "html", "p", "span") */
            _log(`  standardTag <${$node._tag}> processing its value/content.`);
            _log(make_string($node._content));
            let stdJson: JsonType = {};
            if ($node._content && $node._content.length === 1) {
                const recursed = jsonFromNode($node._content[0] as HsonNode);
                stdJson = { [$node._tag]: recursed };
            } else if ($node._content && $node._content.length > 1) {
                /*  This implies a cluster of values if a standard tag has multiple content VSNs
                    (should be rare or never) */
                _throw_transform_err(`<${$node._tag}> has multiple content VSN children`, 'serialize_json', $node);
            } else { /*  empty content, value remains [] */
                stdJson = { [$node._tag]: '' };
            }

            // (this does nothing??)
            if (Array.isArray(stdJson)) {
                _log('item is array  for', $node._tag)
                _log(make_string(stdJson))
                return stdJson;
            }
            /* handle _meta */
            const meta = $node._meta;
            const hasATTRS = meta.attrs && Object.keys(meta.attrs).length > 0;
            const hasFLAGS = meta.flags && meta.flags.length > 0;
            if (hasATTRS || hasFLAGS) {
                const metaForJson: { attrs?: HsonAttrs, flags?: HsonFlags } = {};
                if (hasATTRS) metaForJson.attrs = { ...meta!.attrs };
                if (hasFLAGS) metaForJson.flags = [...meta!.flags];
                stdJson._meta = { ...metaForJson };
            }
            return stdJson;
        }
    }
}