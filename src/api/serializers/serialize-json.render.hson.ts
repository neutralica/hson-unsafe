import { _ } from "ajv";
import { HsonNode, JsonType, JSONObject, BasicValue, HsonAttrs, HsonFlags } from "../../types-consts/types.hson.js";
import { ROOT_TAG, ARRAY_TAG, OBJECT_TAG, PRIM_TAG, STRING_TAG, ELEM_TAG, INDEX_TAG } from "../../types-consts/constants.hson.js";
import { is_indexed, is_Node } from "../../utils/is-helpers.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";


/* debug log */
let _VERBOSE = false;
const $log = _VERBOSE
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
        console.error("[node_to_json_string] Error during final JSON.stringify:", e.message);
        console.error("[node_to_json_string] Structure that failed to stringify:", serializedJson);
        return `"[JSON_STRINGIFY_ERROR]"`;
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
        console.warn(`error in node or node tag: ${$node}`)
        return "[ERROR IN NODE OR NODE.TAG]";
    }


    /* step 1: catch VSNs */
    $log(`NEXT: ${$node._tag}`)

    switch ($node._tag) {
        case ROOT_TAG: {
            let root: JsonType | null = null;
            $log(`  <_root>: processing content`);
            root = jsonFromNode($node._content[0] as HsonNode);
            if (root === null) throw new Error('_root is null')
            return root;
        }

        case ARRAY_TAG: {
            $log(`  <_array> tag reached: creating JSON array`);
            $log(make_string($node));
            let array = [];
            if ($node._content) { /*  content of _array node must be _ii nodes */
                for (const iiNode of $node._content as HsonNode[]) {
                    if (is_indexed(iiNode)) {
                        array.push(jsonFromNode(iiNode._content[0] as HsonNode));
                    } else {
                        console.warn(make_string(iiNode))
                        console.warn(make_string($node))
                        console.error(`malformed _ii node in _array`);
                    }
                }
            }
            return array;
        }

        case OBJECT_TAG: {
            /* check if _obj is just a wrapper around a primitive VSN */
            if ($node._content.length === 1) {
                const childNode = $node._content[0] as HsonNode;
                /* If the single child is a _prim or _str, this _obj is just a wrapper.
                     unwrap the value directly and return the primitive, ignoring the VSN tags */
                if (childNode._tag === PRIM_TAG || childNode._tag === STRING_TAG) {
                    $log(`  <_obj>: unwrapping simple ${typeof childNode._content[0]} value: `, make_string(childNode._content[0]));
                    return jsonFromNode(childNode);
                }
                return jsonFromNode(childNode);
            }

            /* if not, it's an object builder */
            $log(`  <_obj>: constructing JSON object from properties`);
            const properties: JSONObject = {};

            /* get the object's properties--the nodes in its .content */
            for (const prop of ($node._content as HsonNode[])) {
                if (!is_Node(prop) || !prop._tag) {
                    /*  skip invalid children */
                    console.error('invalid child inside _obj:', prop);
                    continue;
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


        case PRIM_TAG: {
            /* return Primitive content directly */
            $log(`  <_prim>: returning number value: ${$node._content[0]}`);
            return $node._content[0] as BasicValue;
        }

        case STRING_TAG: {
            /* need to make sure that string_tag content is stringified; a number will be stored un-stringified
                in a string node's content; it is still supposed to be stringified before serializing */
            $log(`  <_str>: returning string value: "${String($node._content[0])}"`);
            const str = (typeof $node._content[0] === 'number') ? String($node._content[0]) : $node._content[0] as BasicValue;
            return str;
        }

        case ELEM_TAG: {
            /* _elem tags are native to HTML and will be carried through the JSON as-is; the only 
                exceptional handling is the contents of _elem tags are not rewrapped in an _obj */
            $log('[recurseJSON] processing _elem VSN');
            const elemItems: JsonType = [];
            for (const itemNode of ($node._content)) {
                /* recursively convert each item node in the _elem to its JSON equivalent */
                $log('recursing: ', itemNode)
                const jsonItem = jsonFromNode(itemNode as HsonNode);
                elemItems.push(jsonItem);
                $log('pushing list item to _elem:')
                $log(jsonItem)
            }
            $log('returning list items:', elemItems)
            return { [ELEM_TAG]: elemItems };
        }

        case INDEX_TAG: /* _ii nodes within an array */
            $log('node.tag is index tag');
            /*  these are _array content wrappers; their JSON form is the JSON form of their single content item */
            let iiContent: JsonType = {}
            if ($node._content && $node._content.length === 1) {
                iiContent = jsonFromNode($node._content[0] as HsonNode);
            } else {
                console.error('misconfigured index tag: ', make_string($node));
                iiContent = "[ERROR MISCONFIG _ii]";
            }
            return iiContent;

        default: { /* "standard" tag (e.g. "foo", "kingdom", "html", "p", "span") */
            $log(`  standardTag <${$node._tag}> processing its value/content.`);
            $log(make_string($node._content));
            let stdJson: JsonType = {};
            if ($node._content && $node._content.length === 1) {
                const recursed = jsonFromNode($node._content[0] as HsonNode);
                stdJson = { [$node._tag]: recursed };
            } else if ($node._content && $node._content.length > 1) {
                /*  This implies a cluster of values if a standard tag has multiple content VSNs
                    (should be rare or never) */
                console.error(`    <${$node._tag}> has multiple content items (non-idiomatically)\nmapping to _array.`);
                stdJson = { [$node._tag]: ($node._content as HsonNode[]).map(item => jsonFromNode(item)) };
            } else { /*  empty content, value remains [] */
                stdJson = { [$node._tag]: '' };
            }

            // (this does nothing??)
            if (Array.isArray(stdJson)) {
                $log('item is array  for', $node._tag)
                $log(make_string(stdJson))
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