import { HsonNode, JSONShape, JSONObject, BasicValue, HsonAttrs, HsonFlags } from "../../types-consts/base.types.hson.js";
import { ROOT_TAG, ARRAY_TAG, OBJECT_TAG, PRIM_TAG, STRING_TAG, ELEM_TAG, INDEX_TAG } from "../../types-consts/constants.types.hson.js";
import { is_indexed, is_Node } from "../../utils/is-helpers.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";

/* debug log */
let VERBOSE = false;
const $log = VERBOSE
    ? console.log
    : () => { };


export function serialize_json($node: HsonNode): string {
        console.groupCollapsed('---> serializing json');
        console.log('input node:');
        console.log(make_string($node));
        console.groupEnd();
    const serializedJson = jsonFromNode($node);

    try {
        const json = make_string({ [ROOT_TAG]: serializedJson });
        console.groupCollapsed('returning json:');
        console.log(json);
        console.groupEnd();
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
 * @returns {JSONShape} the resulting javascript object, array, or primitive value
 */

function jsonFromNode($node: HsonNode): JSONShape {

    if (!$node || typeof $node.tag !== 'string') {
        console.warn(`error in node or node tag: ${$node}`)
        return "[ERROR IN NODE OR NODE.TAG]";
    }


    /* step 1: catch VSNs */
    $log(`NEXT: ${$node.tag}`)

    switch ($node.tag) {
        case ROOT_TAG: {
            let root: JSONShape | null = null;
            $log(`  <_root>: processing content`);
            root = jsonFromNode($node.content[0] as HsonNode); 
            if (root === null) throw new Error('_root is null')
            return root;
        }

        case ARRAY_TAG: {
            $log(`  <_array> tag reached: creating JSON array`);
            $log(make_string($node));
            let array = [];
            if ($node.content) { /*  content of _array node must be _ii nodes */
                for (const iiNode of $node.content as HsonNode[]) {
                    if (is_indexed(iiNode)) {
                        array.push(jsonFromNode(iiNode.content[0] as HsonNode));
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
            if ($node.content.length === 1) {
                const childNode = $node.content[0] as HsonNode;
                /* If the single child is a _prim or _str, this _obj is just a wrapper.
                     unwrap the value directly and return the primitive, ignoring the VSN tags */
                if (childNode.tag === PRIM_TAG || childNode.tag === STRING_TAG) {
                    $log(`  <_obj>: unwrapping simple ${typeof childNode.content[0]} value: `, make_string(childNode.content[0]));
                    return jsonFromNode(childNode);
                }
                return jsonFromNode(childNode);
            }

            /* if not, it's an object builder */
            $log(`  <_obj>: constructing JSON object from properties`);
            const properties: JSONObject = {};

            /* get the object's properties--the nodes in its .content */
            for (const prop of ($node.content as HsonNode[])) {
                if (!is_Node(prop) || !prop.tag) {
                    /*  skip invalid children */
                    console.error('invalid child inside _obj:', prop);
                    continue;
                }

                const key = prop.tag;
                let value = null;

                /* the value is property's unwrapped content */
                if (prop.content && prop.content.length > 0) {
                    value = jsonFromNode(prop.content[0] as HsonNode);
                }

                properties[key] = value;
            }
            return properties;
        }


        case PRIM_TAG: {
            /* return Primitive content directly */
            $log(`  <_prim>: returning number value: ${$node.content[0]}`);
            return $node.content[0] as BasicValue;
        }

        case STRING_TAG: {
            /* need to make sure that string_tag content is stringified; a number will be stored un-stringified
                in a string node's content; it is still supposed to be stringified before serializing */
            $log(`  <_str>: returning string value: "${String($node.content[0])}"`);
            const str = (typeof $node.content[0] === 'number') ? String($node.content[0]) : $node.content[0] as BasicValue;
            return str;
        }

        case ELEM_TAG: {
            /* _elem tags are native to HTML and will be carried through the JSON as-is; the only 
                exceptional handling is the contents of _elem tags are not rewrapped in an _obj */
            $log('[recurseJSON] processing _elem VSN');
            const elemItems: JSONShape = [];
            for (const itemNode of ($node.content)) {
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
            let iiContent: JSONShape = {}
            if ($node.content && $node.content.length === 1) {
                iiContent = jsonFromNode($node.content[0] as HsonNode);
            } else {
                console.error('misconfigured index tag: ', make_string($node));
                iiContent = "[ERROR MISCONFIG _ii]";
            }
            return iiContent;

        default: { /* "standard" tag (e.g. "foo", "kingdom", "html", "p", "span") */
            $log(`  standardTag <${$node.tag}> processing its value/content.`);
            $log(make_string($node.content));
            let stdJson: JSONShape = {};
            if ($node.content && $node.content.length === 1) {
                const recursed = jsonFromNode($node.content[0] as HsonNode);
                stdJson = { [$node.tag]: recursed };
            } else if ($node.content && $node.content.length > 1) {
               /*  This implies a cluster of values if a standard tag has multiple content VSNs
                   (should be rare or never) */
                console.error(`    <${$node.tag}> has multiple content items (non-idiomatically)\nmapping to _array.`);
                stdJson = { [$node.tag]: ($node.content as HsonNode[]).map(item => jsonFromNode(item)) };
            } else { /*  empty content, value remains [] */
                stdJson = { [$node.tag]: '' };
            } 
            
            // (this does nothing??)
            if (Array.isArray(stdJson)) {
                $log('item is array  for', $node.tag)
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