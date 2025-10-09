// parse-json.transform.hson.ts

import { HsonNode, Primitive } from "../..";
import { is_Primitive, is_Object, is_not_string } from "../../core/utils/guards.core.utils";
import { VAL_TAG, STR_TAG, ARR_TAG, OBJ_TAG, EVERY_VSN, II_TAG, ELEM_TAG, ROOT_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { _DATA_INDEX, _META_DATA_PREFIX } from "../../types-consts/constants";
import { JsonType, HsonMeta, JsonObj, HsonAttrs } from "../../types-consts/node.new.types";
import { assert_invariants } from "../../utils/assert-invariants.utils";
import { _snip } from "../../utils/snip.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
import { make_string } from "../../utils/make-string.utils";



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
        _throw_transform_err(`unknown VSN-like tag: <${$parentTag}>`, 'parse-html', make_string($srcJson));
    }

    if ($parentTag === STR_TAG || $parentTag === VAL_TAG) {
        if (!is_Primitive($srcJson)) {
            _throw_transform_err('values must be string, bool, number, or null', 'parse_json');
        }
        if (is_not_string($srcJson)) {
            return {
                node: CREATE_NODE({
                    _tag: VAL_TAG,
                    _content: [$srcJson as Primitive],
                }),
            };
        } else {
            const node = CREATE_NODE({
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

            return CREATE_NODE({
                _tag: II_TAG, /* <_ii> wrapper */
                _content: [itemConversion.node], /* the item itself */
                _meta: dataIx
            });
        });
        return {
            node: CREATE_NODE({
                _tag: ARR_TAG,
                _content: items,
            }),
        };
    }

    /* catch objects */
    if ($parentTag === OBJ_TAG) {
        const RESERVED = new Set(["_attrs", "_meta", "_elem", "_obj", "_arr", "_ii", "_root", "_str", "_val"]);

        if ($srcJson && typeof $srcJson === "object" && !Array.isArray($srcJson)) {
            const obj: Record<string, unknown> = $srcJson as Record<string, unknown>;

            // ─────────────────────────────────────────────────────────────
            // NEW: handle the (legal) element-cluster object: { _elem: [ { _attrs?, <tag>: <children> } ] }
            //      NOTE: _elem *inside* a generic _obj property is illegal, but this object *is itself* the cluster.
            // ─────────────────────────────────────────────────────────────
            // ─────────────────────────────────────────────────────────────
            // HANDLE ELEMENT-CLUSTER OBJECT: { _elem: [ ...items ] }
            // ─────────────────────────────────────────────────────────────
            if (Array.isArray((obj as any)._elem)) {
                // CHANGED: accept 0..n (no "exactly one" rule here)
                const items = (obj as any)._elem as Array<unknown>;

                const children: HsonNode[] = [];

                for (let i = 0; i < items.length; i++) {
                    const it = items[i];

                    // CHANGED: strings -> _str
                    if (typeof it === 'string') {
                        children.push(CREATE_NODE({ _tag: STR_TAG, _content: [it] }));
                        continue;
                    }

                    // CHANGED: boolean|number|null -> _val
                    if (it === null || typeof it === 'boolean' || typeof it === 'number') {
                        children.push(CREATE_NODE({ _tag: VAL_TAG, _content: [it as Primitive] }));
                        continue;
                    }

                    // Objects: must be an element-object with exactly one non-underscore key (the tag)
                    if (it && typeof it === 'object' && !Array.isArray(it)) {
                        const elObj = it as Record<string, unknown>;

                        // NOTE: Only _attrs is allowed as a leading underscore key here
                        const tagKeys = Object.keys(elObj).filter(k => !k.startsWith('_'));

                        const tagName = tagKeys[0];
                        const rawChildren = elObj[tagName] as JsonType;

                        // _attrs is optional; VSNs never carry _attrs
                        const elemAttrs: HsonAttrs | undefined =
                            elObj._attrs && typeof elObj._attrs === "object" && !Array.isArray(elObj._attrs)
                                ? (elObj._attrs as HsonAttrs)
                                : undefined;

                        // CHANGED: build element children WITHOUT boxing scalars in _obj (that rule is for generic _obj props)
                        let tagKids: HsonNode[] = [];
                        if (rawChildren != null) {
                            if (typeof rawChildren === 'string') {
                                if (rawChildren.length > 0) tagKids.push(CREATE_NODE({ _tag: STR_TAG, _content: [rawChildren] }));
                            } else if (Array.isArray(rawChildren) || is_Object(rawChildren)) {
                                tagKids.push(nodeFromJson(rawChildren, getTag(rawChildren)).node);
                            } else {
                                tagKids.push(CREATE_NODE({ _tag: VAL_TAG, _content: [rawChildren as Primitive] }));
                            }
                        }

                        // assemble the HTML tag node
                        children.push(CREATE_NODE({
                            _tag: tagName,
                            _attrs: elemAttrs,
                            _content: tagKids
                        }));
                        continue;
                    }

                    // Anything else is illegal under _elem
                    return _throw_transform_err(
                        `invalid item at _elem[${i}] (must be string|number|boolean|null or element-object)`,
                        "parse_json",
                        make_string(it)
                    );
                }

                // RETURN: _elem VSN containing 0..n children (tags/_str/_val)
                return { node: CREATE_NODE({ _tag: ELEM_TAG, _content: children }) };
            }

            const objAttrs: HsonAttrs | undefined =
                (obj._attrs && typeof obj._attrs === "object" && !Array.isArray(obj._attrs))
                    ? (obj._attrs as HsonAttrs)
                    : undefined;

            const objMeta: HsonMeta = dataOnlyMeta((obj as any)._meta);

            const nonReservedKeys = Object.keys(obj).filter(k => !RESERVED.has(k));

            // ─────────────────────────────────────────────────────────────
            // GENERIC OBJECT → _obj VSN with property nodes
            // ─────────────────────────────────────────────────────────────
            const propertyNodes: HsonNode[] = nonReservedKeys.map((key) => {
                const raw: JsonType = obj[key] as JsonType;
                const built = nodeFromJson(raw, getTag(raw)).node;

                // keep your “always-wrap scalars under _obj” rule for generic object properties
                const child: HsonNode =
                    (built._tag === STR_TAG || built._tag === VAL_TAG)
                        ? CREATE_NODE({ _tag: OBJ_TAG, _content: [built] })
                        : built;

                return CREATE_NODE({ _tag: key, _content: [child] });
            });

            return {
                node: CREATE_NODE({ _tag: OBJ_TAG, _content: propertyNodes }),
            };
        }
    }

    /* error fallback */
    _throw_transform_err("recurse_json_for_node: unhandled tag:", "parse_json", make_string($srcJson));
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