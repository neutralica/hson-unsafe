// get-self-value.utils.ts

import { Primitive } from "../core/types-consts/core.types";
import { _FALSE, ELEM_OBJ_ARR, FALSE_TYPE, STR_TAG, VAL_TAG } from "../types-consts/constants";
import { HsonNode_NEW } from "../types-consts/node.new.types";
import { is_Node_NEW } from "./node-guards.new.utils";

/* debug log */
const VERBOSE = false;
const $log = VERBOSE ? console.log : () => { };

// CHANGED: explicit primitive guard used before returning wrapper content
function isPrimitive(v: unknown): v is Primitive {
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

/**
 * checks if a node is a candidate for single-line formatting and returns
 * its primitive value if it is. A node qualifies if it has NO metadata and
 * its ONLY content is a single _str or _val VSN wrapper
 *
 * @param $node The HsonNode to inspect
 * @returns The primitive value if the pattern is matched, otherwise _FALSE
 */
export function get_self_close_value($node: HsonNode_NEW): Primitive | FALSE_TYPE {
    /*  1. self-closing tags cannot be VSN containers */
    $log("  ? checking for Self Value (if applicable) ", $node._tag);
    if (ELEM_OBJ_ARR.includes($node._tag)) {
        return _FALSE;
    }

    // 2) CHANGED: compute “no meta” without accessing possibly-undefined bags
    const meta = $node._meta;
    const hasNoMeta =
        !meta ||
        ((!(meta as any).attrs || Object.keys((meta as any).attrs).length === 0) &&
            (!(meta as any).flags || (meta as any).flags.length === 0));

    if (!hasNoMeta) {
        $log(" XXX -> $false: it has meta");
        return _FALSE;
    }

    // 3) CHANGED: normalize content → require exactly one child
    const content = Array.isArray($node._content) ? $node._content : [];
    if (content.length !== 1) {
        $log("  > $FALSE - node._content must contain exactly one child");
        return _FALSE;
    }

    const childNode = content[0];
    $log("object is a node; getting content:", childNode);

    // 4) CHANGED: ensure first child is a node before touching ._content
    if (!is_Node_NEW(childNode)) {
        $log("  > $FALSE - first child is not a node");
        return _FALSE;
    }

    // 5) CHANGED: normalize child’s content → require exactly one grandchild
    const childContent = Array.isArray(childNode._content) ? childNode._content : [];
    if (childContent.length !== 1) {
        $log("  > $FALSE - child must contain exactly one grandchild");
        return _FALSE;
    }

    const grandChildNode = childContent[0];

    // 6) CHANGED: grandchild must be a node wrapper (_str/_val)
    if (!is_Node_NEW(grandChildNode)) {
        $log("  > $FALSE - grandchild is not a node");
        return _FALSE;
    }

    // 7) wrapper must be _str or _val and contain exactly one primitive
    if (grandChildNode._tag === STR_TAG || grandChildNode._tag === VAL_TAG) {
        const primArr = Array.isArray(grandChildNode._content) ? grandChildNode._content : [];
        if (primArr.length !== 1) {
            $log("  > $FALSE - wrapper must contain exactly one primitive");
            return _FALSE;
        }
        const prim = primArr[0];
        if (!isPrimitive(prim)) {
            $log("  > $FALSE - wrapper content is not primitive");
            return _FALSE;
        }

        $log(" --> IS self-closing");
        return prim; // CHANGED: fully narrowed Primitive (no assertions)
    }

    /* if the structure does not match this exact pattern, it's not a self-closing tag */
    $log(" fallback; defaulting to $FALSE");
    return _FALSE;
}
