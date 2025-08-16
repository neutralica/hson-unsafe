// parse-html.new.transform.hson.ts (new)

import { parse_html } from "../../../api/parsers/parse-html.transform.hson";
import { Primitive } from "../../../core/types-consts/core.types.hson";
import { is_Primitive, is_not_string } from "../../../core/utils/guards.core.utils.hson";
import { ROOT_TAG, ELEM_TAG, VAL_TAG, STRING_TAG, OBJECT_TAG, ARRAY_TAG, INDEX_TAG } from "../../../types-consts/constants.hson";
import { coerce } from "../../../utils/coerce-string.utils.hson";
import { expand_bools } from "../../../utils/expand-booleans.utils.hson";
import { expand_entities } from "../../../utils/expand-entities.utils.hson";
import { expand_void_tags } from "../../../utils/expand-self-closing.utils.hson";
import { make_string } from "../../../utils/make-string.utils.hson";
import { is_indexed, is_Node } from "../../../utils/node-guards.utils.hson";
import { parse_css_attrs } from "../../../utils/parse-css.utils.hson";
import { _throw_transform_err } from "../../../utils/throw-transform-err.utils.hson";
import { NEW_NEW_NODE } from "../../types-consts/constants.new.hson";
import { HsonAttrs_NEW, HsonMeta_NEW, HsonNode_NEW } from "../../types-consts/new.types.hson";
import { is_indexed_NEW, is_string_NEW } from "../../utils/node-guards.new.utils.hson";

/* debug log */
let _VERBOSE = false;
const $log = _VERBOSE
    ? console.log
    : () => { };


export function parse_html_NEW($input: string | Element): HsonNode_NEW {
    let inputElement: Element;
    if (_VERBOSE) {
        console.groupCollapsed('--->  parsing html');
        console.log('input html:');
        console.log($input);
        console.groupEnd();
    }
    if (typeof $input === 'string') {
        const bools = expand_bools($input);
        const ents = expand_entities(bools);
        const self = expand_void_tags(ents);
        const parser = new DOMParser();

        /*  try parsing the string as-is */
        let parsedXML = parser.parseFromString(self, 'application/xml');
        let parseError = parsedXML.querySelector('parsererror');

        /* if it's a fragment, we wrap and re-parse. */
        if (parseError && parseError.textContent && parseError.textContent.includes('xtra content')) {
            const wrappedInput = `<${ROOT_TAG}>\n${self}</${ROOT_TAG}>`;
            parsedXML = parser.parseFromString(wrappedInput, 'application/xml');
            /*  check for any new, non-recoverable errors */
            parseError = parsedXML.querySelector('parsererror');
        }
        if (parseError) {
            console.error("XML Parsing Error:", parseError.textContent);
            _throw_transform_err(`Failed to parse input HTML/XML`, 'parse_html', parseError.textContent);
        }
        if (!parsedXML.documentElement) {
            /* for cases where parsing might result in no documentElement (e.g., empty string after processing) */
            console.warn("HTML string resulted in no documentElement after parsing; Returning _root");
            _throw_transform_err('[ERROR-no content from xml parse]', 'parse-html', parsedXML);
        }
        inputElement = parsedXML.documentElement;
    } else {
        inputElement = $input;
    }


    /* call convert() on the top-level element */
    const actualContentRootNode = convert(inputElement);

    /* create the _root VSN wrapper */
    const final = actualContentRootNode._tag === ROOT_TAG
        ? actualContentRootNode
        : NEW_NEW_NODE({
            _tag: ROOT_TAG,
            _content: [NEW_NEW_NODE({
                _tag: ELEM_TAG,
                _content: [actualContentRootNode]
            }) as HsonNode_NEW], /* parsed document/element becomes the first child of _root */
        });
    if (_VERBOSE) {
        console.groupCollapsed('returning nodes:');
        console.log(make_string(final));
        console.groupEnd();
    }
    return final;
}

// --- Your Primary Recursive Conversion Function ---

function convert($el: Element): HsonNode_NEW {
    const baseTag = $el.tagName;
    const tagLower = baseTag.toLowerCase();


    if (tagLower === VAL_TAG.toLowerCase()) {
        const text = $el.textContent?.trim() || '';
        const primitive_content = coerce(text); /* turns "1" into number 1 */
        return NEW_NEW_NODE({ _tag: VAL_TAG, _content: [primitive_content] });
    }
    // const attrs: HsonAttrs = {};
    // const flags: string[] = [];
    const attrsAcc: HsonAttrs_NEW = {};

    for (const { name, value } of Array.from($el.attributes)) {
        /* boolean flags like 'defer' */
        if (value === "" || value === name) {
            // if (name)        // I think unnecessary    
            attrsAcc[name] = name;

        }
        /* 'style' attribute only treated as an object */
        else if (name === 'style') {
            attrsAcc.style = parse_css_attrs(value);
        }
        /* all other attributes should be forced to be strings. */
        else {
            attrsAcc[name] = value;
        }
    }

    const sortedAcc: HsonAttrs_NEW = {};
    Object.keys(attrsAcc).sort().forEach(k => {
        sortedAcc[k] = attrsAcc[k];
    });

    const currentMeta: HsonMeta_NEW = {};

    /* tags that the HTML spec defines as "raw text elements": */
    const specialExceptions = ['style', 'script'];
    if (specialExceptions.includes(tagLower)) {

        const text_content = $el.textContent?.trim();
        if (text_content) {
            const special_content = [NEW_NEW_NODE({
                _tag: STRING_TAG,
                _content: [text_content],
            })]
            const wrapper = NEW_NEW_NODE({
                _tag: ELEM_TAG,
                _content: special_content,
            });

            return NEW_NEW_NODE({
                _tag: baseTag,
                _content: [wrapper],
                _attrs: sortedAcc,
            });
        }

    }

    /* ---> if it's not one of the special exceptions, proceed with general handling <--- */
    /*          - process all other tags                                */
    const childNodes: HsonNode_NEW[] = [];
    const children = elementToNode($el.childNodes);

    for (const child of children) {
        /* primitive values are wrapped in a string or value tag */
        if (is_Primitive(child)) {
            const tag = is_string_NEW(child) ? STRING_TAG : VAL_TAG;
            childNodes.push(NEW_NEW_NODE({ _tag: tag, _content: [child] }));

        } else {
            /* or it's already a Node: push it directly. */
            childNodes.push(child as HsonNode_NEW);
        }
    }

    /**  ---> determine the final Node structure based on tag --- 
     * if the current HTML tag ITSELF IS a VSN container tag (e.g., <_obj>, <_array>, <_elem>)
     *  then its child nodes are its direct content 
     **/

    if (tagLower === OBJECT_TAG) {
        /*  "children" of <_obj> are the object's properties (as nodes) */
        return NEW_NEW_NODE({ _tag: OBJECT_TAG, _content: childNodes });
    } else if (tagLower === ARRAY_TAG) {
        /* children of an <_array> should be <_ii> nodes. */
        if (!childNodes.every(node => is_indexed_NEW)) _throw_transform_err('_array children are not valid index tags', 'parse_html', $el);
        return NEW_NEW_NODE({ _tag: ARRAY_TAG, _content: childNodes });
    } else if (tagLower === ELEM_TAG) {
        /* _elem should not be wrapped but should disappear back into the HTML */
        _throw_transform_err('_elem tag found in html', 'parse-html', $el);;
    }

    /*  ---> default: "standard tag" (e.g., "div", "p", "kingdom", "_root") <--- */

    /* its HsonNode._content must be an array containing a single VSN
         or an empty array if it had no content */

    if (childNodes.length === 0) {
        /* tag is empty/void (e.g., <p></p> or <extinctGroups></extinctGroups>)
             its HsonNode's content should be [] so simply return `content:[]` */
        return NEW_NEW_NODE({ _tag: baseTag, _content: [], _attrs: sortedAcc });
    } else if (
        (childNodes.length === 1 && is_Node(childNodes[0])
            && (childNodes[0]._tag === OBJECT_TAG || childNodes[0]._tag === ARRAY_TAG))) {
        return NEW_NEW_NODE({ _tag: baseTag, _content: [childNodes[0]], _attrs: sortedAcc });

    } else if (tagLower === INDEX_TAG) {
        if (childNodes.length !== 1) {
            _throw_transform_err('<_ii> must have exactly one child', 'parse-html', $el);
        }
        const di = sortedAcc['data-index'];
        const meta: HsonMeta_NEW | undefined = di != null ? { 'data-index': String(di) } : undefined;
        return NEW_NEW_NODE({ _tag: INDEX_TAG, _content: [childNodes[0]], _meta: meta });
    } else if (tagLower === VAL_TAG) {
        return NEW_NEW_NODE({ _tag: VAL_TAG, _content: [childNodes[0]] });

    }
    _throw_transform_err('end of parser function reached; tag does not match any case', 'parse_html', $el);
}

/** 
 * parses child DOM nodes and returns an array of HsonNodes.
 *  - recursively calls `convert` for element children and creates VSNs for BasicValue children. 
 * @param {NodeListOf<ChildNode>} $els - the nodes in question
 * @returns {(HsonNode_NEW | Primitive)[]} - either a finished Node or a primitive value
 */

function elementToNode($els: NodeListOf<ChildNode>): (HsonNode_NEW | Primitive)[] {
    const children: (HsonNode_NEW | Primitive)[] = [];
    for (const kid of Array.from($els)) {
        if (kid.nodeType === Node.ELEMENT_NODE) {
            /* recurse elements */
            children.push(convert(kid as Element));
        } else if (kid.nodeType === Node.TEXT_NODE) {
            const text = kid.textContent;
            /* v important - push the raw, coerced primitive string or number
                do not wrap it in VSN here. */
            if (text && text.trim()) {
                children.push(text.trim());
            }
        }
    }
    return children;
}