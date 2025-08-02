// --- serialize-hson.hson.render.ts ---

import { HsonMeta, HsonAttrs, HsonNode, Primitive } from "../../types-consts/types.hson.js";
import { STRING_TAG, VAL_TAG, INDEX_TAG, ARRAY_TAG, ELEM_TAG, OBJECT_TAG, _FALSE } from "../../types-consts/constants.hson.js";
import { format_hson_attrs } from "../../utils/format-hson-attrs.utils.hson.js";
import { get_self_close_value } from "../../utils/get-self-value.utils.hson.js";
import { is_Primitive as is_Primitive, is_void, is_PRIM_or_STR_Node as is_ValueVsn, is_Node } from "../../utils/is-helpers.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { serialize_primitive } from "../../utils/serialize-primitive.utils.hson.js";
import { throw_transform_err } from "../../utils/throw-transform-err.utils.hson.js";



/* debug log */
let _VERBOSE = false;
const $log = _VERBOSE
    ? console.log
    : () => { };


function formatHsonMeta($meta: HsonMeta | undefined): string {
    if (!$meta) {
        return "";
    }

    /* call the attrs helper once with the entire attrs object */
    const attributesString = $meta.attrs ? format_hson_attrs($meta.attrs) : "";

    /* format flags (simple unquoted strings) */
    const flagsString = $meta.flags ? ` ${$meta.flags.join(' ')}` : "";

    /* combine them; the leading space is handled by the helper/formatter */
    return `${attributesString}${flagsString}`;
}

/* indentation getter */
function getIndent($level: number): string {
    return "  ".repeat($level); /* currently 2 spaces per level */
}

/**
 * recursively serializes an hsonnode tree into a formatted hson string.
 *
 * this function is the core serializer for the hson format. it handles
 * indentation, attribute formatting, and correctly applies context-aware
 * closers ('>' for object properties vs. '/>' for list items) based
 * on the parent's vsn.
 *
 * @param {HsonNode} $input - the node or primitive value to serialize.
 * @param {number} $indent_level - the current indentation level for pretty-printing.
 * @param {typeof ELEM_TAG | typeof OBJECT_TAG} [$vsn] - the vsn context provided by the parent node, used to determine the correct closer for one-liners.
 * @returns {string} the formatted hson string representation of the node.
 */

function hsonFromNode(
    $input: HsonNode | Primitive,
    $indent_level: number,
    $vsn?: typeof ELEM_TAG | typeof OBJECT_TAG,
): string {
    const currentIndent = getIndent($indent_level);

    /* Primitives */
    if (is_Primitive($input)) {
        const value = serialize_primitive($input)
        return currentIndent + value;
    }
    const node: HsonNode = { ...($input || {}) };
    const oneLinerValue = get_self_close_value(node);
    /* 2. if the helper returned a value, format the one-liner */
    if (oneLinerValue !== _FALSE) { /* sentinel value for generic no-result boolean */
        /* (self nodes may have no attributes) */
        const tag = node._tag;
        const valString = serialize_primitive(oneLinerValue);

        if ($vsn === ELEM_TAG) {
            return `${currentIndent}<${tag} ${valString} />`;
        } else {
            return `${currentIndent}<${tag} ${valString}>`;
        }
    }

    const {  _tag: tag, _attrs,  _content: content = [], _meta } = node || {};

    const attrs = _meta.attrs ?? {};
    const flags = _meta.flags ?? [];


    const meta_string = formatHsonMeta({ attrs, flags }); // Your helper

    /*  2. disappear VSNs */
    if (tag === STRING_TAG || tag === VAL_TAG) {
        if (content.length !== 1 || !is_Primitive(content[0])) {
            throw_transform_err('_str or _prim nodes must have 1 and only 1 hson  in content', 'serialize-hson', node);
        }

        const value = currentIndent + make_string(content[0])
        return value;
    }
    if (tag === INDEX_TAG) {
        if (content.length !== 1) { throw_transform_err('_ii nodes must have 1 & only 1 child', 'serialize-hson', node); }
        if (!is_Node(content[0])) {
            throw_transform_err('index tag contents are not nodes', 'serialize-hson', content)
        }
        /* recurse the child with the SAME indent level. */
        return hsonFromNode(content[0], $indent_level + 1, $vsn);
    }

    /* --- 3. container VSNs --- */
    if (tag === ARRAY_TAG) {
        if (content.length === 0) {
            return `«»`;
        }

        const hson_content = content
            .map(itemNode => `${hsonFromNode(itemNode, $indent_level)}`)
            .join(',\n');
        return `${currentIndent}«\n${hson_content}\n${currentIndent}»`;
    }

    /* --- 4. 'standard' tags --- */

    /*  determine the node's type and structure,
         build the output based on those characteristics */
    if (is_void(content)) {
        /*  case A: void node -> self closing: <tag /> */
        return `${currentIndent}<${tag}${meta_string} />`;
    }

    /* case C: all other nodes are treated as blocks */
    /* 1. establish defaults */
    let actualContent = content as HsonNode[];
    let parentTag = tag; // The VSN context we will pass to children.

    /* 2. check for a VSN to not-include */
    const firstChild = content?.[0] as HsonNode | undefined;
    const shouldMelt = content.length === 1 && firstChild && (firstChild._tag === ELEM_TAG || firstChild._tag === OBJECT_TAG);

    if (shouldMelt) {
        /* if found the content content and context come from that child */
        actualContent = firstChild._content as HsonNode[];
        parentTag = firstChild._tag;
    }

    /* 3. derive the closer and context */
    const closer = (parentTag === ELEM_TAG) ? '/>' : '>';
    const childVsn = parentTag;
    let finalVsn: typeof ELEM_TAG | typeof OBJECT_TAG = OBJECT_TAG;
    if (childVsn === ELEM_TAG || childVsn === OBJECT_TAG) {
        finalVsn = childVsn;
    }

    const processedNodes = actualContent
        .map(child => hsonFromNode(child, $indent_level + 1, finalVsn)) // Pass context here
        .join('\n');
    const finalTag = tag === OBJECT_TAG ? '' : tag;
    return `${currentIndent}<${finalTag}${meta_string}\n${processedNodes}\n${currentIndent}${closer}`;
}

/**
 * serializes the entire hson node tree into a final hson string
 *
 * this function serves as the main entry point for hson serialization,
 * initiating the recursive process by calling the `hsonFromNode` helper
 * on the root node
 *
 * @param {HsonNode} $root - the root node of the data structure to be serialized.
 * @returns {string} the complete, formatted hson string.
 */

export function serialize_hson($root: HsonNode): string {
    if (_VERBOSE) {
        console.groupCollapsed('---> serializing hson')
        console.log('beginning node:')
        console.log(make_string($root));
        console.groupEnd()
    }

    if (!$root || !is_Node($root)) throw_transform_err('no _root node found in data', 'serialize-hson', $root);
    const hson = hsonFromNode($root, 0).trim();

    if (_VERBOSE) {
        console.groupCollapsed('returning HSON:')
        console.log(hson);
        console.groupEnd()
    }
    return hson;
}