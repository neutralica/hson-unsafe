import { Primitive } from "../../core/types-consts/core.types.hson.js";
import { STR_TAG, BLANK_META, VSNTag, NODE_ELEMENT_MAP, VAL_TAG, VSN_TAGS } from "../../types-consts/constants.hson.js";
import { HsonNode } from "../../types-consts/node.types.hson.js";
import { is_Node } from "../../utils/node-guards.utils.hson.js";
import { serialize_style } from "../../utils/serialize-css.utils.hson.js";

/**
 * Recursively renders an HsonNode into a DOM 'liveTree', establishing
 * an entangled link between the HsonNode and its corresponding HTMLElement.
 * @param {HsonNode | Primitive} $node The HsonNode to render.
 * @returns  {Node}An HTMLElement or Text node.
 */

export function create_live_tree($node: HsonNode | Primitive): Node {
    /* create a text node to display malformed content */
    if (!is_Node($node)) {

        return document.createTextNode(String($node ?? ''));
    }

    const graft = $node as HsonNode;

    /*  if the node is a primitive wrapper VSN, treat it like an unwrapped primitive */
    if (graft._tag === STR_TAG || graft._tag === VAL_TAG) {
        const textNode = document.createTextNode(String(graft._content?.[0] ?? ''));
        return textNode;
    }

    /* or: it's an element node */
    const el = document.createElement(graft._tag);


    if (!graft._meta) graft._meta = BLANK_META;
    NODE_ELEMENT_MAP.set(graft, el);

    /* apply attrs and flags */
    if (graft._meta.attrs) {
        for (const key in graft._meta.attrs) {
            const value = graft._meta.attrs[key];

            // Check if the attribute is 'style' and its value is an object
            if (key === 'style' && typeof value === 'object' && value !== null) {
                // Use your helper to convert the object to a CSS string
                el.setAttribute('style', serialize_style(value));
            } else {
                // For all other attributes, use the existing logic
                el.setAttribute(key, String(value));
            }
        }
    }

    if (graft._meta.flags) {
        for (const flag of graft._meta.flags) {
            if (typeof flag === 'string')
                el.setAttribute(flag, ''); /* setting the attribute name with an empty string is the HTML convention for flags (vs XML flag="flag") */
        }
    }

    /* 4. if container, add to its content; if not, render the content directly */
    if (graft._content) {

        const container = graft._content.find(
            (c): c is HsonNode =>
                is_Node(c) &&
                VSN_TAGS.includes(c._tag as VSNTag)



        );

        if (container) {

            /* case A: VSN container found; render its children
                this handles nodes coming from the HTML parser */
            if (container._content) {
                for (const childNode of container._content) {
                    el.appendChild(create_live_tree(childNode));
                }
            }
        } else {
            /* case B: no VSN container found
                the content is a direct list of nodes/primitives
                (handles nodes created by `.append()`) */

            for (const childNode of graft._content) {
                el.appendChild(create_live_tree(childNode));
            }
        }
    }

    return el;
}