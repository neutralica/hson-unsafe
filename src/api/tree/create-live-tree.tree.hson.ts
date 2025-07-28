import { HsonNode, BasicValue } from "../../types-consts/base.types.hson.js";
import { STRING_TAG, BLANK_META, VSNContainerTags, NODE_ELEMENT_MAP, PRIM_TAG } from "../../types-consts/base.const.hson.js";
import { is_Node } from "../../utils/is-helpers.utils.hson.js";
import { serialize_css } from "../../utils/serialize-css.utils.hson.js";

/**
 * Recursively renders an HsonNode into a DOM 'liveTree', establishing
 * an entangled link between the HsonNode and its corresponding HTMLElement.
 * @param {HsonNode | BasicValue} $node The HsonNode to render.
 * @returns  {Node}An HTMLElement or Text node.
 */

export function create_live_tree($node: HsonNode | BasicValue): Node {
    /* create a text node to display malformed content */
    if (!is_Node($node)) {

        return document.createTextNode(String($node ?? ''));
    }

    const graft = $node as HsonNode;

    /*  if the node is a primitive wrapper VSN, treat it like an unwrapped primitive */
    if (graft.tag === STRING_TAG || graft.tag === PRIM_TAG) {
        const textNode = document.createTextNode(String(graft.content?.[0] ?? ''));
        return textNode;
    }

    /* or: it's an element node */
    const el = document.createElement(graft.tag);


    if (!graft._meta) graft._meta = BLANK_META;
    NODE_ELEMENT_MAP.set(graft, el);

    /* apply attrs and flags */
    if (graft._meta.attrs) {
        for (const key in graft._meta.attrs) {
            const value = graft._meta.attrs[key];

            // Check if the attribute is 'style' and its value is an object
            if (key === 'style' && typeof value === 'object' && value !== null) {
                // Use your helper to convert the object to a CSS string
                el.setAttribute('style', serialize_css(value));
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
    if (graft.content) {

        const container = graft.content.find(
            (c): c is HsonNode => is_Node(c) && VSNContainerTags.includes(c.tag)
        );

        if (container) {

            /* case A: VSN container found; render its children
                this handles nodes coming from the HTML parser */
            if (container.content) {
                for (const childNode of container.content) {
                    el.appendChild(create_live_tree(childNode));
                }
            }
        } else {
            /* case B: no VSN container found
                the content is a direct list of nodes/primitives
                (handles nodes created by `.append()`) */

            for (const childNode of graft.content) {
                el.appendChild(create_live_tree(childNode));
            }
        }
    }

    return el;
}