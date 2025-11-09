// serialize-json.render.ts

import { Primitive } from "../../core/types-consts/core.types";
import { assert_invariants } from "../../diagnostics/assert-invariants.utils";
import { is_indexed_NEW } from "../../utils/node-utils/node-guards.new.utils";
import { ROOT_TAG, EVERY_VSN, ARR_TAG, OBJ_TAG, STR_TAG, VAL_TAG, ELEM_TAG, II_TAG } from "../../types-consts/constants";
import { JsonType, JsonObj, HsonNode } from "../../types-consts/node.new.types";
import { clone_node } from "../../utils/node-utils/clone-node.utils";
import { make_string } from "../../utils/primitive-utils/make-string.nodes.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";

export function serialize_json($node: HsonNode): string {
    const clone = clone_node($node)
    assert_invariants(clone, 'serialize_json')
    const serializedJson = jsonFromNode(clone);
    try {
        const json = make_string(serializedJson);
        return json;
    } catch (e: any) {
        _throw_transform_err(`error during final JSON.stringify\n ${e.message}`, 'serialize-json');
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

    if (!$node || (typeof $node._tag !== 'string')) {
        console.warn('warning! node is type: ', typeof $node);
        _throw_transform_err(`Invalid node or node tag`, 'serialize_json');
    }

        if ($node._tag.startsWith("_") && !EVERY_VSN.includes($node._tag)) {
            _throw_transform_err(`unknown VSN-like tag: <${$node._tag}>`, 'parse-html');
        }
    
    /* step 1: catch VSNs */

    switch ($node._tag) {
        case ROOT_TAG: {
            if (!$node._content || $node._content.length !== 1) {
               console.error(make_string($node))
                _throw_transform_err('malformed _root node -  must have exactly one child', 'serialize_json');
            }
            // The recursive call now expects the child to be in the NEW format.
            return jsonFromNode($node._content[0] as HsonNode);
        }

        case ARR_TAG: {
            let array: JsonType[] = [];
            if ($node._content) {
                /*  content of _array node must be _ii nodes */
                for (const iiNode of $node._content as HsonNode[]) {
                    if (is_indexed_NEW(iiNode)) {
                        array.push(jsonFromNode(iiNode._content[0] as HsonNode));
                    } else {
                        _throw_transform_err(`malformed _ii node in _array`, 'serialize-json');
                    }
                }
            }
            return array;
        }

        case OBJ_TAG: {
            const jsonObj: JsonObj = {};
            if ($node._content && $node._content.length === 1) {
                const only = $node._content[0] as HsonNode;
                // unwrap primitive/array/object/elem wrappers produced by the parser
                if (only._tag === STR_TAG || only._tag === VAL_TAG || only._tag === ARR_TAG || only._tag === OBJ_TAG || only._tag === ELEM_TAG) {
                    return jsonFromNode(only); // <- avoids calling with a primitive later
                }
            }
            if ($node._content) {
                for (const propNode of $node._content as HsonNode[]) {
                    const key = propNode._tag;
                    let value: JsonType = {};
                    if (propNode._content && propNode._content.length > 0) {
                        const child = propNode._content[0];
                        // CHANGED: assign directly; do NOT Object.assign into {}
                        value = jsonFromNode(child as HsonNode);
                    }
                    jsonObj[key] = value as JsonType;
                }
            }
            return jsonObj;
        }


        case STR_TAG:
        case VAL_TAG: {
            /* return Primitive content directly */
            return $node._content[0] as Primitive;
        }

        case ELEM_TAG: {
            /* _elem tags are native to HTML and will be carried through the JSON as-is; the only 
                exceptional handling is the contents of _elem tags are not rewrapped in an _obj */
            const elemItems: JsonType = [];
            for (const itemNode of ($node._content)) {
                /* recursively convert each item node in the _elem to its JSON equivalent */
                const jsonItem = jsonFromNode(itemNode as HsonNode);
                elemItems.push(jsonItem);
            }
            return { [ELEM_TAG]: elemItems };
        }
        case II_TAG: {
            if (!$node._content || $node._content.length !== 1) {
                _throw_transform_err('misconfigured _ii node', 'serialize_json');
            }
            return jsonFromNode($node._content[0] as HsonNode);
        }

        default: { /* "standard" tag (e.g. "foo", "kingdom", "html", "p", "span") */

            let tempJson: JsonObj = {};
            if ($node._content && $node._content.length === 0) {
                tempJson = { [$node._tag]: '' };
            } else if ($node._content && $node._content.length === 1) {
                const recursed = jsonFromNode($node._content[0] as HsonNode);
                tempJson = { [$node._tag]: recursed };
            } else if ($node._content && $node._content.length > 1) {
                /*  This implies a cluster of values if a standard tag has multiple content VSNs
                    (should be rare or never) */
                _throw_transform_err(`<${$node._tag}> has multiple content VSN children`, 'serialize_json');
            }

            /* handle _meta */
            const hasAttrs = $node._attrs && Object.keys($node._attrs).length > 0;
            const hasMeta = $node._meta && Object.keys($node._meta).length > 0;
            const finalJson: JsonObj = tempJson;

            if (hasAttrs) {
                (finalJson as any)._attrs = {
                    ...(finalJson as any)._attrs,
                    ...($node._attrs as Record<string, unknown>)
                };
            }

            // meta stays as-is
            if (hasMeta) {
                (finalJson as any)._meta = $node._meta;
            }
            return finalJson;
        }
    }
}