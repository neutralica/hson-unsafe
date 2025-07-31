import { HsonNode, BasicValue } from "../../types-consts/types.hson.js";
import { STRING_TAG, PRIM_TAG, VSNContainerTags, INDEX_TAG, ROOT_TAG } from "../../types-consts/constants.hson.js";
import { is_BasicValue, is_Node } from "../is-helpers.utils.hson.js";

/**
 * recursive function that strips off VSN clutter and returns core data in 
 * its native structure for intuitive traversal and manipulation
 */
export function strip_VSNs(node: HsonNode | BasicValue | undefined): any {
    /*  1. base case: BasicValues and their VSN wrappers resolve to the raw value */
    if (is_BasicValue(node)) {
        return node;
    }
    if (!is_Node(node)) {
        return undefined;
    }
    switch (node.tag) {
        case STRING_TAG:
        case PRIM_TAG:
            return node.content[0];
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
    const container = node.content.find(c => is_Node(c) && VSNContainerTags.includes(c.tag)) as HsonNode | undefined;

    if (container && container.content.length > 0) {
        for (const child of container.content) {
           /*  unwrapping the _ii for array items is handled by the recursive call */
            const processedChild = strip_VSNs(child);
            if (processedChild !== undefined) {
                contentArray.push(processedChild);
            }
        }
    }

    /* return only the content of index or root */
    if (node.tag === INDEX_TAG || node.tag === ROOT_TAG) {
        return contentArray;
    }

    // 4. final assembly: return the single-key object representation for this node
    if (contentArray.length === 1 && is_BasicValue(contentArray[0])) {
        /* if just a single primitive, unwrap it */
        return { [node.tag]: contentArray[0] };
    } else {
        /* otherwise keep the array to preserve structure */
        return { [node.tag]: contentArray };
    }
}
