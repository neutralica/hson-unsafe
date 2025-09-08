// get-self-value.utils.hson.ts

import { Primitive } from "../core/types-consts/core.types.hson";
import { FALSE_TYPE, ELEM_OBJ_ARR, _FALSE, STR_TAG, VAL_TAG } from "../types-consts/constants.hson";
import { HsonNode_NEW } from "../new/types-consts/node.new.types.hson";
import { is_Node_NEW } from "../new/utils/node-guards.new.utils.hson";

/* debug log */
const VERBOSE = false;
const $log = VERBOSE
    ? console.log
    : () => { }

/**
 * checks if a node is a candidate for single-line formatting and returns
 * its primitive value if it is. A node qualifies if it has NO metadata and
 * its ONLY content is a single _str or _val VSN wrapper
 *
 * @param $node The HsonNode to inspect
 * @returns The primitive value if the pattern is matched, otherwise _FALSE
 */
export function get_self_close_value($node: HsonNode_NEW): Primitive | FALSE_TYPE {
    /*  1. self-closing tags cannot have any attrs or flags */
    $log('  ? checking for Self Value (if applicable) ', $node._tag);
    if (ELEM_OBJ_ARR.includes($node._tag)) {
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
    if (!$node._content || $node._content.length !== 1 || !is_Node_NEW($node._content[0])) {
        $log('  > $FALSE - node._content is undefined or >1 or not a Hson node')
        return _FALSE;
    }

    const childNode = $node._content[0];
    $log('object is a node; getting content:', childNode)
    if (!is_Node_NEW(childNode) || !is_Node_NEW(childNode._content[0]) || childNode._content.length > 1) {
        $log('  > $FALSE - not self closing: too many child nodes')
        return _FALSE;
    }
    const grandChildNode = childNode._content[0];
    /* 3. that single child node must be a primitive wrapper (_str or _val) */
    if (grandChildNode._tag === STR_TAG || grandChildNode._tag === VAL_TAG) {
        /* success: return the primitive value directly from inside the wrapper */
        $log(' --> IS self-closing')
        return grandChildNode._content[0] as Primitive;
    }

    /* if the structure does not match this exact pattern, it's not a self-closing tag*/
    $log(' fallback; defaulting to $FALSE')
    return _FALSE;
}