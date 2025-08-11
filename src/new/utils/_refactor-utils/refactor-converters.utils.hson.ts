// refactor-converters.utils.hson.ts

import { BLANK_META } from "../../types-consts/constants.hson";
import { HsonMeta_NEW, HsonNode, HsonNode_NEW, Primitive } from "../../types-consts/types.hson";
import { is_new_Node, is_Node } from "../is-helpers.utils.hson";


/**
 * Converts a node from the old format (_meta.attrs, _meta.flags) 
 * to the new format (top-level _attrs).
 */
export function toNewFormat(node: HsonNode): HsonNode_NEW {
    if (!node) return node;

    // 1. Initialize the new node structure.
    const newNode: HsonNode_NEW = {
        _tag: node._tag,
        _attrs: {},
        _content: [],
        _meta: {},
    };

    // 2. Combine attrs and flags into the new top-level _attrs.
    const oldAttrs = node._meta?.attrs || {};
    const oldFlags = node._meta?.flags || [];
    
    // Copy existing attributes
    newNode._attrs = { ...oldAttrs };
    
    // Convert flags (e.g., 'disabled') to attribute pairs (e.g., { disabled: 'disabled' })
    for (const flag of oldFlags) {
        if (typeof flag === 'string') {
            newNode._attrs[flag] = flag;
        }
    }

    // 3. Recursively convert all child nodes.
    if (node._content) {
        // We cast the result because the map correctly produces an array of the new type.
        newNode._content = node._content.map(child =>
            is_Node(child) ? toNewFormat(child) : child
        ) as (HsonNode_NEW | Primitive)[];
    }
    
    // 4. Handle the rest of _meta, ensuring type compatibility.
    const { attrs, flags, ...restOfMeta } = node._meta || {};
    if (restOfMeta['data-index'] !== undefined) {
        // Correct the 'data-index' type from number to string.
        (restOfMeta as any)['data-index'] = String(restOfMeta['data-index']);
    }
    
    if (Object.keys(restOfMeta).length > 0) {
        newNode._meta = restOfMeta as HsonMeta_NEW;
    }

    return newNode;
}

/**
 * Converts a node from the new format (_attrs) back to the old format (_meta.attrs, _meta.flags).
 */
export function toOldFormat(node: HsonNode_NEW): HsonNode {
    if (!node) return node;
    
    const oldNode: HsonNode = {
        _tag: node._tag,
        _content: [],
        _meta: { ...BLANK_META }, // Start with a clean slate for the old meta structure
    };

    // 1. Separate top-level _attrs back into _meta.attrs and _meta.flags.
    if (node._attrs) {
        for (const key in node._attrs) {
            const value = node._attrs[key];
            // If key and value match, it's a flag.
            if (key === value) {
                oldNode._meta.flags.push(key);
            } else {
                // Otherwise, it's a standard attribute.
                oldNode._meta.attrs[key] = value;
            }
        }
    }

    // 2. Recursively convert all child nodes.
    if (node._content) {
        // We cast the result because the map correctly produces an array of the old type.
        oldNode._content = node._content.map(child => 
            is_new_Node(child) ? toOldFormat(child as HsonNode_NEW) : child
        ) as (HsonNode | Primitive)[];
    }
    
    // 3. Merge remaining _meta properties.
    if (node._meta) {
        Object.assign(oldNode._meta, node._meta);
    }

    return oldNode;
}