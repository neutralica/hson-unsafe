// strip-vsns.utils.ts

import { is_Primitive } from "../cote-utils/guards.core";
import { HsonNode} from "../../types-consts/node.types";
import { STR_TAG, VAL_TAG, VSN_TAGS, II_TAG, ROOT_TAG } from "../../types-consts/constants";
import { is_Node } from "../node-utils/node-guards";
import { Primitive } from "../../types-consts/core.types";

/**
 * Convert an HSON node tree into a “plain” JS structure by stripping VSN
 * (Virtual Structural Node) wrappers like `_root`, `_elem`, `_obj`, `_arr`,
 * and `_ii`.
 *
 * Intent:
 * - Make the data easier to traverse/manipulate without caring about HSON’s
 *   structural scaffolding.
 *
 * Behavior:
 * - Primitives return as-is.
 * - `_str` / `_val` return their single primitive payload.
 * - For other nodes, collects (a) attributes and (b) unwrapped child content.
 * - If the current node is `_root` or `_ii`, returns the raw collected array
 *   instead of a `{ tag: ... }` wrapper.
 * - Otherwise returns `{ [tag]: payload }` where payload is either:
 *   - a single primitive (unwrapped), or
 *   - an array preserving order/structure.
 *
 * Notes / caveats:
 * - This is a lossy transform: it discards metadata and the distinction between
 *   different VSN cluster shapes beyond their resulting content.
 * - Attribute handling is intentionally order-preserving (as single-key objects),
 *   which is convenient for round-trippy inspection but not the most ergonomic
 *   data model for programmatic use.
 *
 * @param node - An HSON node, a primitive, or `undefined`
 * @returns A plain JS representation of the tree (lossy). Returns `undefined`
 *          when input is not an HSON node or primitive.
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
