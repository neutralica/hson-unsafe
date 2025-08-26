// strip-vsns.utils.hson.ts

import { Primitive } from "../../core/types-consts/core.types.hson";
import { is_Primitive } from "../../core/utils/guards.core.utils.hson";
import { STR_TAG, VAL_TAG, II_TAG, ROOT_TAG, VSN_TAGS } from "../../types-consts/constants.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { is_Node } from "../node-guards.utils.hson";


/**
 * recursive function that strips off VSN clutter and returns core data in 
 * its native structure for intuitive traversal and manipulation
 */
export function strip_VSNs(node: HsonNode | Primitive | undefined): any {
    /*  1. base case: BasicValues and their VSN wrappers resolve to the raw value */
    if (is_Primitive(node)) {
        return node;
    }
    if (!is_Node(node)) {
        return undefined;
    }
    switch (node._tag) {
        case STR_TAG:
        case VAL_TAG:
            return node._content[0];
    }

    /* this is the representation for an element like <html>, <p>, <span>, etc */
    const contentArray: any[] = [];

    /* 2. add attributes first as single-key objects (this preserves source order) */
    if (node._meta.attrs) {
        for (const key in node._meta.attrs) {
            contentArray.push({ [key]: node._meta.attrs[key] });
        }
    }
    // 12JUL2025 just noticed flags were absent here too; hopefully this didn't break anything
    if (node._meta.flags) {
        for (const key in node._meta.flags) {
            contentArray.push({ [key]: node._meta.flags[key] });
        }
    }

    /* 3. process and add children */
    const container = node._content.find(c => is_Node(c) && VSN_TAGS.includes(c._tag)) as HsonNode | undefined;

    if (container && container._content.length > 0) {
        for (const child of container._content) {
           /*  unwrapping the _ii for array items is handled by the recursive call */
            const processedChild = strip_VSNs(child);
            if (processedChild !== undefined) {
                contentArray.push(processedChild);
            }
        }
    }

    /* return only the content of index or root */
    if (node._tag === II_TAG || node._tag === ROOT_TAG) {
        return contentArray;
    }

    // 4. final assembly: return the single-key object representation for this node
    if (contentArray.length === 1 && is_Primitive(contentArray[0])) {
        /* if just a single primitive, unwrap it */
        return { [node._tag]: contentArray[0] };
    } else {
        /* otherwise keep the array to preserve structure */
        return { [node._tag]: contentArray };
    }
}
