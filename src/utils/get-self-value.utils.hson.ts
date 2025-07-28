// get-self-value.utils.hson.ts

import { HsonNode, BasicValue } from "../types-consts/base.types.hson.js";
import { STRING_TAG, PRIM_TAG, _FALSE, FALSE_TYPE, ARRAY_TAG, ELEM_TAG, ELEM_OBJ_ARR } from "../types-consts/base.const.hson.js";
import { is_Node } from "./is-helpers.utils.hson.js";

/* debug log */
const VERBOSE = false;
const $log = VERBOSE
    ? console.log
    : ()=>{}

/**
 * checks if a node is a candidate for single-line formatting and returns
 * its primitive value if it is. A node qualifies if it has NO metadata and
 * its ONLY content is a single _str or _prim VSN wrapper
 *
 * @param $node The HsonNode to inspect
 * @returns The primitive value if the pattern is matched, otherwise _FALSE
 */
export function get_self_close_value($node: HsonNode): BasicValue | FALSE_TYPE {
    /*  1. self-closing tags cannot have any attrs or flags */
    $log('  ? checking for Self Value (if applicable) ', $node.tag);
    if (ELEM_OBJ_ARR.includes($node.tag)) {
        return _FALSE; 
    }
    
    const hasNoMeta = (!$node._meta) ||
        ((!$node._meta.attrs || Object.keys($node._meta.attrs).length === 0) &&
            (!$node._meta.flags || $node._meta.flags.length === 0));
    if (!hasNoMeta) {
        $log(' XXX -> $false: it has meta')
        return _FALSE;
    }

    /* 2. content must be a single node */
    if (!$node.content || $node.content.length !== 1 || !is_Node($node.content[0])) {
        $log('  > $FALSE - node.content is undefined or >1 or not a Hson node')
        return _FALSE;
    }

    const childNode = $node.content[0];
    $log('object is a node; getting content:', childNode)
    if (!is_Node(childNode.content[0]) || childNode.content.length > 1) {
        $log('  > $FALSE - not self closing: too many child nodes')
        return _FALSE;
    }
    const grandChildNode = childNode.content[0];
    /* 3. that single child node must be a primitive wrapper (_str or _prim) */
    if (grandChildNode.tag === STRING_TAG || grandChildNode.tag === PRIM_TAG) {
       /* success: return the primitive value directly from inside the wrapper */
        $log(' --> IS self-closing')
        return grandChildNode.content[0] as BasicValue;
    }

    /* if the structure does not match this exact pattern, it's not a self-closing tag*/
    $log(' fallback; defaulting to $FALSE')
    return _FALSE;
}