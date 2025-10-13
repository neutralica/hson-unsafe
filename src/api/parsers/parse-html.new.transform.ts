// parse-html.new.transform.hson.ts (new)

import { HsonNode, Primitive, is_Node_NEW } from "../..";
import { is_Primitive } from "../../core/utils/guards.core.utils";
import { ROOT_TAG, ELEM_TAG, STR_TAG, EVERY_VSN, VAL_TAG, OBJ_TAG, ARR_TAG, II_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { assert_invariants } from "../../utils/assert-invariants.utils";
import { coerce } from "../../utils/coerce-string.utils";
import { escape_text_nodes } from "../../utils/escape-text-nodes.new.utils";
import { expand_entities } from "../../utils/expand-entities.utils";
import { expand_flags } from "../../utils/expand-flags.utils";
import { expand_void_tags } from "../../utils/expand-self-closing.utils";
import { make_string } from "../../utils/make-string.utils";
import { is_string_NEW, is_indexed_NEW } from "../../utils/node-guards.new.utils";
import { parse_html_attrs } from "../../utils/parse_html_attrs.utils";
import { _snip } from "../../utils/snip.utils";
import { strip_html_comments } from "../../utils/strip-html-comments.new.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";

/* debug log */
let _VERBOSE = false;
const _log: (...args: Parameters<typeof console.log>) => void =
    _VERBOSE
        ? (...args) => console.log(
            '[parse_html_NEW]: ',
            ...args.map(a => (typeof a === "string" ? _snip(a, 500) : a)))   // ← prefix + passthrough
        : () => { };



export function parse_html($input: string | Element): HsonNode {
    let inputElement: Element;

    if (typeof $input === 'string') {
        const stripped = strip_html_comments($input);
        const bools = expand_flags(stripped);
        const safe = escape_text_nodes(bools);  // handles &, <, > in text nodes
        const ents = expand_entities(safe);
        const final = expand_void_tags(ents);

        const parser = new DOMParser();
        let parsedXML = parser.parseFromString(final, 'application/xml');
        let parseError = parsedXML.querySelector('parsererror');

        // If it looks like a fragment, wrap in _root and retry
        if (parseError && parseError.textContent?.includes('xtra content')) {
            const wrapped = `<${ROOT_TAG}>\n${final}</${ROOT_TAG}>`;
            parsedXML = parser.parseFromString(wrapped, 'application/xml');
            parseError = parsedXML.querySelector('parsererror');
        }
        if (parseError) {
            console.error("XML Parsing Error:", parseError.textContent);
            _throw_transform_err(`Failed to parse input HTML/XML`, 'parse-html');
        }
        inputElement = parsedXML.documentElement!;
    } else {
        inputElement = $input;
    }
    const actualContentRootNode = convert(inputElement);
    const final = wrap_as_root(actualContentRootNode);

    assert_invariants(final, "parse-html");
    return final;
}

// --- recursive conversion function ---

function convert($el: Element): HsonNode {
    if (!($el instanceof Element)) {
        _throw_transform_err('input to convert function is not Element', '[(parse-html): convert()]', $el);
    }

    const baseTag = $el.tagName;
    const tagLower = baseTag.toLowerCase();
    const { attrs: sortedAcc, meta: metaAcc } = parse_html_attrs($el);

    if (tagLower === STR_TAG) {
        _throw_transform_err('literal <_str> is not allowed in input HTML', 'parse-html');
    }
    if (tagLower.startsWith('_') && !EVERY_VSN.includes(tagLower)) {
        _throw_transform_err(`unknown VSN-like tag: <${tagLower}>`, 'parse-html');
    }

    // Raw text elements: treat their textContent as a single string node
    const specialExceptions = ['style', 'script'];
    if (specialExceptions.includes(tagLower)) {
        const text_content = $el.textContent?.trim();
        if (text_content) {
            const str = CREATE_NODE({ _tag: STR_TAG, _content: [text_content] });
            return CREATE_NODE({
                _tag: baseTag,
                _attrs: sortedAcc,
                _meta: metaAcc && Object.keys(metaAcc).length ? metaAcc : undefined,
                // CHANGED: no inner _elem — children go directly
                _content: [str],
            });
        }
    }

    // Build children (DOM → HSON)
    _log('standard tag - processing child nodes:');
    const childNodes: HsonNode[] = [];
    const children = elementToNode($el.childNodes);
    _log(make_string(children));

    for (const child of children) {
        if (is_Primitive(child)) {
            const tag = is_string_NEW(child) ? STR_TAG : VAL_TAG;
            childNodes.push(CREATE_NODE({ _tag: tag, _content: [child] }));
        } else {
            childNodes.push(child as HsonNode);
        }
    }

    _log(`determining final node structure per tag ${tagLower}`);

    // ---------- VSN tags in HTML ----------

    if (tagLower === VAL_TAG) {
        // CHANGED: minimal, canonical <_val> handling (coerce strings → non-string primitive)
        if (childNodes.length !== 1) {
            _throw_transform_err('<_val> must contain exactly one value', 'parse-html');
        }

        const only = children[0] as unknown; // pre-wrapped atom from elementToNode

        const coerceNonString = (s: string): Primitive => {
            const v = coerce(s); // use your canonical coerce
            return v as Primitive;
        };

        let prim: Primitive | undefined;

        if (is_Primitive(only)) {
            prim = (typeof only === 'string') ? coerceNonString(only) : (only as Primitive);
        } else if (only && typeof only === 'object' && '_tag' in (only as any)) {
            const n = only as HsonNode;
            if (n._tag !== VAL_TAG && n._tag !== STR_TAG) {
                _throw_transform_err('<_val> must contain a primitive or _str/_val', 'parse-html');
            }
            const c = n._content?.[0];
            if (c === undefined) _throw_transform_err('<_val> payload is empty', 'parse-html');
            prim = (typeof c === 'string') ? coerceNonString(c) : (c as Primitive);
        } else {
            _throw_transform_err('<_val> payload is not an atom', 'parse-html');
        }

        if (typeof prim === 'string') {
            _throw_transform_err('<_val> cannot contain a string after coercion', 'parse-html', prim);
        }

        return CREATE_NODE({ _tag: VAL_TAG, _content: [prim as Primitive] });
    }

    if (tagLower === OBJ_TAG) {
        // Children are property nodes (already produced under this element)
        return CREATE_NODE({ _tag: OBJ_TAG, _content: childNodes });
    }

    if (tagLower === ARR_TAG) {
        _log('array detected; returning in _array wrapper');
        if (!childNodes.every(node => is_indexed_NEW(node))) {
            _throw_transform_err('_array children are not valid index tags', 'parse-html');
        }
        return CREATE_NODE({ _tag: ARR_TAG, _content: childNodes });
    }

    if (tagLower === II_TAG) {
        if (childNodes.length !== 1) {
            _throw_transform_err('<_ii> must have exactly one child', 'parse-html');
        }
        return CREATE_NODE({
            _tag: II_TAG,
            _content: [childNodes[0]],
            _meta: metaAcc && Object.keys(metaAcc).length ? metaAcc : undefined,
        });
    }

    if (tagLower === ELEM_TAG) {
        _throw_transform_err('_elem tag found in html', 'parse-html');
    }

    // ---------- Default: normal HTML element ----------

    if (childNodes.length === 0) {
        // Void element, stay in element mode with empty cluster
        return CREATE_NODE({
            _tag: baseTag,
            _attrs: sortedAcc,
            _meta: metaAcc && Object.keys(metaAcc).length ? metaAcc : undefined,
            _content: [
                CREATE_NODE({ _tag: ELEM_TAG, _meta: {}, _content: [] })
            ]
        });
    }

    if (childNodes.length === 1) {
        const only = childNodes[0];

        // Pass through explicit clusters untouched (no mixing, no extra box)
        if (only._tag === OBJ_TAG || only._tag === ARR_TAG || only._tag === ELEM_TAG) {
            return CREATE_NODE({
                _tag: baseTag,
                _attrs: sortedAcc,
                _meta: metaAcc && Object.keys(metaAcc).length ? metaAcc : undefined,
                _content: [only]
            });
        }
    }

    // Otherwise, we have multiple non-cluster children (text/elements):
    // wrap once in _elem (pure element mode).
    return CREATE_NODE({
        _tag: baseTag,
        _attrs: sortedAcc,
        _meta: metaAcc && Object.keys(metaAcc).length ? metaAcc : undefined,
        _content: [
            CREATE_NODE({
                _tag: ELEM_TAG,
                _meta: {},
                _content: childNodes
            })
        ]
    });
}

// Wrap the result at _root correctly (no blanket _elem around clusters)
function wrap_as_root(node: HsonNode): HsonNode {
    if (node._tag === ROOT_TAG) return node; // already rooted
    if (node._tag === OBJ_TAG || node._tag === ARR_TAG || node._tag === ELEM_TAG) {
        return CREATE_NODE({ _tag: ROOT_TAG, _content: [node] });
    }
    return CREATE_NODE({
        _tag: ROOT_TAG,
        _content: [CREATE_NODE({ _tag: ELEM_TAG, _content: [node] })],
    });
}

/** 
 * parses child DOM nodes and returns an array of HsonNodes.
 *  - recursively calls `convert` for element children and creates VSNs for BasicValue children. 
 * @param {NodeListOf<ChildNode>} $els - the nodes in question
 * @returns {(HsonNode | Primitive)[]} - either a finished Node or a primitive value
 */
function elementToNode($els: NodeListOf<ChildNode>): (HsonNode | Primitive)[] {
    const children: (HsonNode | Primitive)[] = [];

    for (const kid of Array.from($els)) {
        if (kid.nodeType === Node.ELEMENT_NODE) {
            children.push(convert(kid as Element));
            continue;
        }

        if (kid.nodeType === Node.TEXT_NODE) {
            const raw = kid.textContent ?? "";
            const trimmed = raw.trim();

            // handle the empty-string sentinel *after* trimming
            if (trimmed === '""') {
                children.push(
                            CREATE_NODE({
                                _tag: STR_TAG,
                                _meta: {},
                                _content: [""], // <-- the actual empty string
                            }),
                );
                continue;
            }

            // ignore layout-only whitespace; otherwise pass string through
            if (trimmed.length > 0) {
                children.push(trimmed); // (or coerce(trimmed) if that’s your policy)
            }

            continue;
        }

    }

    return children;
}