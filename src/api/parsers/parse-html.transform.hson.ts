
import { HsonAttrs, HsonNode, Primitive } from "../../types-consts/types.hson.js";
import { NEW_NODE, VAL_TAG, STRING_TAG, ROOT_TAG, BLANK_META, ELEM_TAG, OBJECT_TAG, ARRAY_TAG, INDEX_TAG } from "../../types-consts/constants.hson.js";
import { coerce } from "../../utils/coerce-string.utils.hson.js";
import { expand_bools } from "../../utils/expand-booleans.utils.hson.js";
import { expand_entities } from "../../utils/expand-entities.utils.hson.js";
import { expand_void_tags } from "../../utils/expand-self-closing.utils.hson.js";
import { is_Primitive, is_not_string, is_Node } from "../../utils/is-helpers.utils.hson.js";
import { parse_css_attrs } from "../../utils/parse-css.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { throw_transform_err } from "../../utils/throw-transform-err.utils.hson.js";



/* debug log */
let _VERBOSE = false;
const $log = _VERBOSE
    ? console.log
    : () => { };


export function parse_html($input: string | Element): HsonNode {
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
           throw_transform_err(`Failed to parse input HTML/XML`, 'parse_html', parseError.textContent);
        }
        if (!parsedXML.documentElement) {
            /* for cases where parsing might result in no documentElement (e.g., empty string after processing) */
            console.warn("HTML string resulted in no documentElement after parsing; Returning _root");
            throw_transform_err('[ERROR-no content from xml parse]', 'parse-html', parsedXML);
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
        : NEW_NODE({
            _tag: ROOT_TAG,
            _content: [NEW_NODE({
                _tag: ELEM_TAG,
                _content: [actualContentRootNode]
            }) as HsonNode], /* parsed document/element becomes the first child of _root */
        });
    if (_VERBOSE) {
        console.groupCollapsed('returning nodes:');
        console.log(make_string(final));
        console.groupEnd();
    }
    return final;
}

// --- Your Primary Recursive Conversion Function ---

function convert($el: Element): HsonNode {
    const baseTag = $el.tagName;
    const tagLower = baseTag.toLowerCase();


    if (tagLower === VAL_TAG.toLowerCase()) {
        const text = $el.textContent?.trim() || '';
        const primitive_content = coerce(text); /* turns "1" into number 1 */
        return NEW_NODE({ _tag: VAL_TAG, _content: [primitive_content] });
    }
    const attrs: HsonAttrs = {};
    const flags: string[] = [];


    for (const { name, value } of Array.from($el.attributes)) {
        /* boolean flags like 'defer' */
        if (value === "" || value === name) {
            if (name) flags.push(name);
        }
        /* 'style' attribute only treated as an object */
        else if (name === 'style') {
            attrs.style = parse_css_attrs(value);
        }
        /* all other attributes should be forced to be strings. */
        else {
            attrs[name] = value;
        }
    }

    const sortedAttrs: HsonAttrs = {};
    Object.keys(attrs)
        .sort()
        .forEach(key => {
            sortedAttrs[key] = attrs[key];
        });

    const currentMeta = { attrs: sortedAttrs, flags };
    /* tags that the HTML spec defines as "raw text elements": */
    const specialExceptions = ['style', 'script'];

    if (specialExceptions.includes(tagLower)) {

        const text_content = $el.textContent?.trim();
        if (text_content) {
            const special_content = [NEW_NODE({
                _tag: STRING_TAG,
                _content: [text_content],
            })]
            const list_node = NEW_NODE({
                _tag: ELEM_TAG,
                _content: special_content,
            });

            return NEW_NODE({ _tag: baseTag, _content: [list_node], _meta: currentMeta });
        }

    }

    /* ---> if it's not one of the special exceptions, proceed with general handling <--- */
    /* process all normal tags */
    const childNodes: HsonNode[] = [];
    const children = elementToNode($el.childNodes);
    for (const child of children) {
        if (is_Primitive(child)) {
            if (is_not_string(child)) console.warn('number detected', child)
            /* raw primitive--wrap it in the appropriate VSN */
            if (is_not_string(child) && $el.tagName.toLowerCase() !== VAL_TAG.toLowerCase()) {
                childNodes.push(NEW_NODE({ _tag: STRING_TAG, _content: [child] }));
            } else if (is_not_string(child) && $el.tagName.toLowerCase() === VAL_TAG.toLowerCase()) {
                childNodes.push(NEW_NODE({ _tag: VAL_TAG, _content: [child] }));
            } else if (typeof child === 'string') {
                childNodes.push(NEW_NODE({ _tag: STRING_TAG, _content: [child] }));
            } else { /* boolean or null */
                childNodes.push(NEW_NODE({ _tag: VAL_TAG, _content: [child] }));
            }
        } else {
            /* it's already a valid Node: push it directly. */
            childNodes.push(child as HsonNode);
        }
    }
    /*  ---> determine the final Node structure based on tag --- */
    /*  If the current HTML tag ITSELF IS a VSN container tag (e.g., <_obj>, <_array>, <_elem>)
          then its child nodes are its direct content */
    if (tagLower === OBJECT_TAG) {
        /*  "children" of <_obj> are the object's properties (as nodes) */
        return NEW_NODE({ _tag: OBJECT_TAG, _content: childNodes });
    } else if (tagLower === ARRAY_TAG) {
        /* children of an <_array> should be <_ii> nodes. */
        return NEW_NODE({ _tag: ARRAY_TAG, _content: childNodes });
    } else if (tagLower === ELEM_TAG) {
        /* _elem should not be wrapped but should disappear back into the HTML */
        throw_transform_err('_elem tag found in html', 'parse-html', $el);;
    }

    /*  ---> default: "standard tag" (e.g., "div", "p", "kingdom", "_root") <--- */

    /* its HsonNode._content must be an array containing a single VSN
         or an empty array if it had no content */

    if (childNodes.length === 0) {
        /* tag is empty/void (e.g., <p></p> or <extinctGroups></extinctGroups>)
             its HsonNode's content should be [] so simply return `content:[]` */
        return NEW_NODE({ _tag: baseTag, _content: [], _meta: currentMeta });
    } else if (
        (childNodes.length === 1 && is_Node(childNodes[0])
            && (childNodes[0]._tag === OBJECT_TAG || childNodes[0]._tag === ARRAY_TAG))) {
        return NEW_NODE({
            _tag: baseTag,
            _content: [childNodes[0]], /* return the VSN wrapping the base tag's content */
            _meta: currentMeta
        });
    } else if ((baseTag === INDEX_TAG || baseTag === VAL_TAG)) {
        return NEW_NODE({
            _tag: baseTag,
            _content: [childNodes[0]], /* return the VSN wrapping the base tag's content */
            _meta: currentMeta
        });
    } else {
        /* default to native _elem wrapper (though ofc defaults are problematic) */
        return NEW_NODE({
            _tag: baseTag,
            _content: [NEW_NODE({ _tag: ELEM_TAG, _content: childNodes, _meta: BLANK_META })], // Standard tag's HsonNode._content is an array with one VSN
            _meta: currentMeta
        });
    }
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