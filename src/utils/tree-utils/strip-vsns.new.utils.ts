// strip-vsns.utils.ts

import { is_Primitive } from "../../core/utils/guards.core.utils";
import { HsonNode, Primitive } from "../../types-consts";
import { STR_TAG, VAL_TAG, VSN_TAGS, II_TAG, ROOT_TAG } from "../../types-consts/constants";
import { is_Node } from "../node-utils/node-guards.new.utils";


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
    const n: HsonNode = node;
    switch (n._tag) {
        case STR_TAG:
        case VAL_TAG:
            return n._content[0];
    }

    /* this is the representation for an element like <html>, <p>, <span>, etc */
    const contentArray: any[] = [];

    /* 2. add attributes first as single-key objects (this preserves source order) */
    if (n._meta.attrs) {
        for (const key in n._attrs) {
            contentArray.push({ [key]: n._attrs[key] });
        }
    }


    /* 3. process and add children */
    const container = n._content.find((c: unknown) => is_Node(c) && VSN_TAGS.includes(c._tag)) as HsonNode | undefined;

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
    if (n._tag === II_TAG || n._tag === ROOT_TAG) {
        return contentArray;
    }

    // 4. final assembly: return the single-key object representation for this node
    if (contentArray.length === 1 && is_Primitive(contentArray[0])) {
        /* if just a single primitive, unwrap it */
        return { [n._tag]: contentArray[0] };
    } else {
        /* otherwise keep the array to preserve structure */
        return { [n._tag]: contentArray };
    }
}
