// serialize-json.render.hson.ts




/* debug log */
let _VERBOSE = false;
const _log = _VERBOSE
    ? console.log
    : () => { };

export function serialize_json($node: HsonNode_NEW): string {
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

function jsonFromNode($node: HsonNode_NEW): JsonType_NEW {

    if (!$node || (typeof $node._tag !== 'string')) {
        console.warn('warning! node is type: ', typeof $node);
        _throw_transform_err(`Invalid node or node tag`, 'serialize_json', $node);
    }

    /* step 1: catch VSNs */
    _log(`NEXT: ${$node._tag}`)

    switch ($node._tag) {
        case ROOT_TAG: {
            if (!$node._content || $node._content.length !== 1) {
                _throw_transform_err('malformed _root node -  must have exactly one child', 'serialize_json', $node);
            }
            // The recursive call now expects the child to be in the NEW format.
            return jsonFromNode($node._content[0] as HsonNode_NEW);
        }

        case ARRAY_TAG: {
            _log(`  <_array> tag reached: creating JSON array`);
            _log(make_string($node));
            let array: JsonType_NEW[] = [];
            if ($node._content) {
                /*  content of _array node must be _ii nodes */
                for (const iiNode of $node._content as HsonNode_NEW[]) {
                    if (is_indexed(iiNode)) {
                        array.push(jsonFromNode(iiNode._content[0] as HsonNode_NEW));
                    } else {
                        _throw_transform_err(`malformed _ii node in _array`, 'serialize-json', $node);
                    }
                }
            }
            return array;
        }

        case OBJECT_TAG: {
            const jsonObj: JsonObj_NEW = {};
            if ($node._content && $node._content.length === 1) {
                const only = $node._content[0] as HsonNode_NEW;
                // unwrap primitive/array/object/elem wrappers produced by the parser
                if (only._tag === STRING_TAG || only._tag === VAL_TAG || only._tag === ARRAY_TAG || only._tag === OBJECT_TAG || only._tag === ELEM_TAG) {
                    return jsonFromNode(only); // <- avoids calling with a primitive later
                }
            }
            if ($node._content) {
                for (const propNode of $node._content as HsonNode_NEW[]) {
                    const key = propNode._tag;
                    let value: JsonType_NEW = {};
                    if (propNode._content && propNode._content.length > 0) {
                        const child = propNode._content[0];
                        // CHANGED: assign directly; do NOT Object.assign into {}
                        value = jsonFromNode(child as HsonNode_NEW);
                    }
                    jsonObj[key] = value as JsonType_NEW;
                }
            }
            return jsonObj;
        }


        case STRING_TAG:
        case VAL_TAG: {
            /* return Primitive content directly */
            _log(`  <_prim>: returning number value: ${$node._content[0]}`);
            return $node._content[0] as Primitive;
        }

        case ELEM_TAG: {
            /* _elem tags are native to HTML and will be carried through the JSON as-is; the only 
                exceptional handling is the contents of _elem tags are not rewrapped in an _obj */
            _log('[recurseJSON] processing _elem VSN');
            const elemItems: JsonType_NEW = [];
            for (const itemNode of ($node._content)) {
                /* recursively convert each item node in the _elem to its JSON equivalent */
                _log('recursing: ', itemNode)
                const jsonItem = jsonFromNode(itemNode as HsonNode_NEW);
                elemItems.push(jsonItem);
                _log('pushing list item to _elem:')
                _log(jsonItem)
            }
            _log('returning list items:', elemItems)
            return { [ELEM_TAG]: elemItems };
        }
        case INDEX_TAG: {
            if (!$node._content || $node._content.length !== 1) {
                _throw_transform_err('misconfigured _ii node', 'serialize_json', $node);
            }
            return jsonFromNode($node._content[0] as HsonNode_NEW);
        }

        default: { /* "standard" tag (e.g. "foo", "kingdom", "html", "p", "span") */
            _log(`  standardTag <${$node._tag}> processing its value/content.`);
            _log(make_string($node._content));

            let tempJson: JsonType_NEW = {};
            if ($node._content && $node._content.length === 1) {
                const recursed = jsonFromNode($node._content[0] as HsonNode_NEW);
                tempJson = { [$node._tag]: recursed };
            } else if ($node._content && $node._content.length > 1) {
                /*  This implies a cluster of values if a standard tag has multiple content VSNs
                    (should be rare or never) */
                _throw_transform_err(`<${$node._tag}> has multiple content VSN children`, 'serialize_json', $node);
            }

            /* handle _meta */
            const hasAttrs = $node._attrs && Object.keys($node._attrs).length > 0;
            const hasMeta = $node._meta && Object.keys($node._meta).length > 0;
            const finalJson: JsonObj_NEW = { [$node._tag]: tempJson };

            // merge on any attributes
            if (hasAttrs) {
                Object.assign(finalJson, $node._attrs);
            }

            // attach meta if present
            if (hasMeta) {
                finalJson._meta = $node._meta;
            }

            return finalJson;
        }
    }
}