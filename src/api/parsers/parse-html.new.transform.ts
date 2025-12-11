// parse-html.new.transform.hson.ts (new)

import { HsonNode } from "../../types-consts/node.types";
import { ROOT_TAG, ELEM_TAG, STR_TAG, EVERY_VSN, VAL_TAG, OBJ_TAG, ARR_TAG, II_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { is_Primitive, is_string } from "../../core/utils/guards.core.utils";
import { _snip } from "../../utils/sys-utils/snip.utils";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { parse_html_attrs } from "../../utils/html-utils/parse_html_attrs.utils";
import { coerce } from "../../utils/primitive-utils/coerce-string.utils";
import { assert_invariants } from "../../diagnostics/assert-invariants.utils";
import { expand_entities } from "../../utils/html-preflights/expand-entities.utils";
import { expand_flags } from "../../utils/html-preflights/expand-flags.utils";
import { expand_void_tags } from "../../utils/html-preflights/expand-self-closing.utils";
import { escape_text } from "../../utils/html-preflights/escape-text.new.utils";
import { strip_html_comments } from "../../utils/html-preflights/strip-html-comments.new.utils";
import { wrap_cdata } from "../../safety/wrap-cdata.utils";
import { optional_endtag_preflight } from "../../utils/html-preflights/optional-endtag.html.utils";
import { escape_attr_angles } from "../../safety/escape_angles.html.utils";
import { dedupe_attrs_html } from "../../safety/dedupe-attrs.html.utils";
import { quote_unquoted_attrs } from "../../utils/html-preflights/quoted-unquoted.utils";
import { mangle_illegal_attrs } from "../../utils/html-preflights/mangle-illegal-attrs.utils";
import { namespace_svg } from "../../utils/html-preflights/namespace-svg";
import { is_indexed } from "../../utils/node-utils/node-guards.new.utils";
import { Primitive } from "../../core/types-consts/core.types";

export function parse_html($input: string | Element): HsonNode {
    let inputElement: Element;

    if (typeof $input === "string") {
        const stripped = strip_html_comments($input);
        const bools = expand_flags(stripped);
        const safe = escape_text(bools);
        const ents = expand_entities(safe);
        const unquotedSafe = quote_unquoted_attrs(ents);
        const quotedSafe = escape_attr_angles(unquotedSafe);
        const xmlNameSafe = mangle_illegal_attrs(quotedSafe);  
        const voids = expand_void_tags(xmlNameSafe);
        const cdata = wrap_cdata(voids);
        const svgSafe = namespace_svg(cdata);

        const ampSafe = svgSafe.replace(
            /&(?!(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]{1,31});)/g,
            "&amp;"
        );

        const parser = new DOMParser();

        // try raw (namespaced) XML first — no preflight yet
        let xmlSrc = ampSafe; // keep the "current" source in one variable
        let parsed = parser.parseFromString(xmlSrc, "application/xml");
        
        let err = parsed.querySelector('parsererror');

        if (err) {
            if (err && /Duplicate|redefined/i.test(err.textContent ?? '')) {
                const deduped = dedupe_attrs_html(xmlSrc);
                if (deduped !== xmlSrc) {
                    xmlSrc = deduped.replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]{1,31});)/g, '&amp;');
                    parsed = parser.parseFromString(xmlSrc, 'application/xml');
                    err = parsed.querySelector('parsererror');
                }
            }
            // 2) try quoting unquoted attrs (only on failure)
            const quoted = quote_unquoted_attrs(xmlSrc);
            if (quoted !== xmlSrc) {
                // re-apply amp fix because quoting might introduce new bare '&'
                xmlSrc = quoted.replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]{1,31});)/g, '&amp;');
                parsed = parser.parseFromString(xmlSrc, 'application/xml');
                err = parsed.querySelector('parsererror');
            }
        }
        if (err && /Unescaped/i.test(err.textContent ?? '')) {
            xmlSrc = escape_attr_angles(xmlSrc);
            parsed = parser.parseFromString(xmlSrc, 'application/xml');
            err = parsed.querySelector('parsererror');
        }

        if (err && /Unescaped .*<.* in attributes/i.test(err.textContent ?? '')) {
            xmlSrc = escape_attr_angles(xmlSrc);
            parsed = parser.parseFromString(xmlSrc, 'application/xml');
            err = parsed.querySelector('parsererror');
        }

        if (err) {
            // 3) now use optional-end-tag preflight
            const balanced = optional_endtag_preflight(xmlSrc);
            if (balanced !== xmlSrc) {
                xmlSrc = balanced;
                parsed = parser.parseFromString(xmlSrc, 'application/xml');
                err = parsed.querySelector('parsererror');
            }
        }

        if (err && /extra content/i.test(err.textContent ?? '')) {
            xmlSrc = `<${ROOT_TAG}>\n${xmlSrc}\n</${ROOT_TAG}>`;
            const reb = optional_endtag_preflight(xmlSrc);
            if (reb !== xmlSrc) xmlSrc = reb;
            parsed = parser.parseFromString(xmlSrc, 'application/xml');
            err = parsed.querySelector('parsererror');
        }

        if (err) {
            console.error("XML Parsing Error:", err.textContent);
            _throw_transform_err(`Failed to parse input HTML/XML`, "parse-html");
        }

        inputElement = parsed.documentElement!;
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
        let text_content = $el.textContent?.trim();

        //  handle <![CDATA[ ... ]]> safely
        if (text_content?.startsWith("<![CDATA[")) {
            const end = text_content.indexOf("]]>");
            if (end === -1) {
                _throw_transform_err("Malformed CDATA block: missing closing ']]>'", "parse-html");
            }
            text_content = text_content.slice("<![CDATA[".length, end);
        }

        if (text_content) {
            const str = CREATE_NODE({ _tag: STR_TAG, _content: [text_content] });
            return CREATE_NODE({
                _tag: baseTag,
                _attrs: sortedAcc,
                _meta: metaAcc && Object.keys(metaAcc).length ? metaAcc : undefined,
                // no inner _elem — children go directly
                _content: [str],
            });
        }
    }

    // Build children (DOM → HSON)
    const childNodes: HsonNode[] = [];
    const children = elementToNode($el.childNodes);

    for (const child of children) {
        if (is_Primitive(child)) {
            const tag = is_string(child) ? STR_TAG : VAL_TAG;
            childNodes.push(CREATE_NODE({ _tag: tag, _content: [child] }));
        } else {
            childNodes.push(child as HsonNode);
        }
    }


    // ---------- VSN tags in HTML ----------

    if (tagLower === VAL_TAG) {
        // minimal, canonical <_val> handling (coerce strings → non-string primitive)
        if (childNodes.length !== 1) {
            _throw_transform_err('<_val> must contain exactly one value', 'parse-html');
        }

        const only = children[0] as unknown; // pre-wrapped atom from elementToNode

        const coerceNonString = (s: string): Primitive => {
            const v = coerce(s); 
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
        if (!childNodes.every(node => is_indexed(node))) {
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
                children.push(trimmed); // (or coerce(trimmed)?)
            }

            continue;
        }

    }

    return children;
}