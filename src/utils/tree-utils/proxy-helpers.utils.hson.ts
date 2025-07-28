// proxy-helpers.tree.hson.ts

import { HsonNode, BasicValue } from "../../types-consts/base.types.hson.js";
import { ELEM_TAG, NEW_NODE, NODE_ELEMENT_MAP, PRIM_TAG, STRING_TAG, VSNContainerTags } from "../../types-consts/base.const.hson.js";
import { is_Node } from "../is-helpers.utils.hson.js";

/*  find the first direct child node with a given tag */
export function find_child_by_tag(parentNode: HsonNode, tag: string): HsonNode | undefined {
    const container = parentNode.content.find(
        (c): c is HsonNode => is_Node(c) && VSNContainerTags.includes(c.tag)
    );

    if (!container) {
        return undefined;
    }

    return container.content.find(
        (child): child is HsonNode => is_Node(child) && child.tag === tag
    );
}

export function find_index_of_tag(parentNode: HsonNode, tag: string): number {
    const container = parentNode.content.find(
        (c): c is HsonNode => is_Node(c) && VSNContainerTags.includes(c.tag)
    );
    if (!container) return -1;

    return container.content.findIndex(
        (child) => is_Node(child) && child.tag === tag
    );
}

/**
 * update primitive content in both the node and DOM (if live)
 */
export function update_content(nodeToUpdate: HsonNode, value: BasicValue): void {
    const hsonContainer = nodeToUpdate.content.find(
        (c): c is HsonNode => is_Node(c) && c.tag === ELEM_TAG
    );
    if (!hsonContainer) return; 

    let hsonTextNode = hsonContainer.content.find(
        (c): c is HsonNode => is_Node(c) && c.tag === STRING_TAG
    );

    /* step 1: update hson model (always) */
    if (hsonTextNode) {
        /*  text node exists; update its value */
        hsonTextNode.content[0] = value;
    } else {
        /* no text node exists; create one and prepend it */
        hsonTextNode = NEW_NODE({tag: STRING_TAG, content: [value]});
        hsonContainer.content.unshift(hsonTextNode);
    }

    /* step 2: update DOM (if linked) */
    const liveParentElement = NODE_ELEMENT_MAP.get(nodeToUpdate);
    if (liveParentElement) {
        /* live element found: sync the DOM to the new model state */
        let liveTextNode = Array.from(liveParentElement.childNodes).find(
            (domNode) => domNode.nodeType === Node.TEXT_NODE
        );

        if (liveTextNode) {
            /* live text node already exists; update it */
            liveTextNode.nodeValue = String(value);
        } else {
            /* or create and prepend a new one */
            const newLiveTextNode = document.createTextNode(String(value));
            liveParentElement.prepend(newLiveTextNode);
        }
    }
}


/* ### looks like this isn't being used? */
/*
 * checks if a node is a simple key-value pair (self-closing token)
 */
export function is_selfClosing($node: HsonNode): boolean {
    /* self-closing tag cannot have attributes */
    const hasAttrsOrFlags = (!!($node._meta?.attrs && Object.keys($node._meta.attrs).length > 0) || !!($node._meta?.flags && Object.keys($node._meta.flags).length > 0));
    if (hasAttrsOrFlags) {
        return false;
    }

    /* find the _elem container for its children. */
    const container = $node.content.find(
        (c): c is HsonNode => is_Node(c) && c.tag === ELEM_TAG
    );
    
    /* the container must exist and have exactly one child */
    if (!container || container.content.length !== 1) {
        return false;
    }

    /* the single child must be a STRING_TAG or PRIM_TAG */
    const singleChild = container.content[0];
    return is_Node(singleChild) && (singleChild.tag === STRING_TAG || singleChild.tag === PRIM_TAG)
}

/**
 * get the primitive value from a self-closing node
 * @param {HsonNode} $node - the node suspected of being a BasicValue-carrier
 * @returns {BasicValue | undefined} - undefined if the content does not match BasicValue carrying structure
 */
export function get_contentValue($node: HsonNode): BasicValue | undefined {
    /* _prim or _str nodes can't have attrs or flags */
    if ($node._meta?.attrs && Object.keys($node._meta.attrs).length > 0) {
        return undefined;
    }
    
    const container = $node.content.find((c): c is HsonNode => is_Node(c) && VSNContainerTags.includes(c.tag));
    
    /* the content is either in container.content or is in the direct child.content*/
    const contentSource = container ? container.content : $node.content;

    /* if there is exactly one child, and it's a BasicValue-carrying node, return its value */
    if (contentSource.length === 1) {
        const singleChild = contentSource[0];
        if (is_Node(singleChild) && (singleChild.tag === STRING_TAG || singleChild.tag === PRIM_TAG)) {
            return singleChild.content[0] as BasicValue;
        }
    }

    return undefined;
}