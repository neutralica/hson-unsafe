// proxy-helpers.tree.hson.ts

import { Primitive } from "../../../core/types-consts/core.types.hson";
import { is_Node_NEW } from "../../../utils/node-guards.new.utils.hson";
import { VSN_TAGS, ELEM_TAG, STR_TAG, VAL_TAG } from "../../../types-consts/constants.hson";
import { NEW_NEW_NODE, NODE_ELEMENT_MAP_NEW } from "../../../types-consts/constants.new.hson";
import { HsonNode_NEW } from "../../../types-consts/node.new.types.hson";



/*  find the first direct child node with a given tag */
export function find_child_by_tag_NEW(parentNode: HsonNode_NEW, tag: string): HsonNode_NEW | undefined {
    const container = parentNode._content.find(
        (c: unknown): c is HsonNode_NEW => is_Node_NEW(c) && VSN_TAGS.includes(c._tag)
    );

    if (!container) {
        return undefined;
    }

    return container._content.find(
        (child: unknown): child is HsonNode_NEW => is_Node_NEW(child) && child._tag === tag
    );
}

export function find_index_of_tag_NEW(parentNode: HsonNode_NEW, tag: string): number {
    const container = parentNode._content.find(
        (c: unknown): c is HsonNode_NEW => is_Node_NEW(c) && VSN_TAGS.includes(c._tag)
    );
    if (!container) return -1;

    return container._content.findIndex(
        (child: unknown) => is_Node_NEW(child) && child._tag === tag
    );
}

/**
 * update primitive content in both the node and DOM (if live)
 */
export function update_content_NEW(nodeToUpdate: HsonNode_NEW, value: Primitive): void {
    const hsonContainer = nodeToUpdate._content.find(
        (c: unknown): c is HsonNode_NEW => is_Node_NEW(c) && c._tag === ELEM_TAG
    );
    if (!hsonContainer) return; 

    let hsonTextNode = hsonContainer._content.find(
        (c: unknown): c is HsonNode_NEW => is_Node_NEW(c) && c._tag === STR_TAG
    );

    /* step 1: update hson model (always) */
    if (hsonTextNode) {
        /*  text node exists; update its value */
        hsonTextNode._content[0] = value;
    } else {
        /* no text node exists; create one and prepend it */
        hsonTextNode = NEW_NEW_NODE({_tag: STR_TAG, _content: [value]});
        hsonContainer._content.unshift(hsonTextNode as HsonNode_NEW);
    }

    /* step 2: update DOM (if linked) */
    const liveParentElement = NODE_ELEMENT_MAP_NEW.get(nodeToUpdate);
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
export function is_selfClosing_NEW($node: HsonNode_NEW): boolean {
    /* self-closing tag cannot have attributes */
    const hasAttrsOrFlags = (!!($node._meta?.attrs && Object.keys($node._meta.attrs).length > 0) || !!($node._meta?.flags && Object.keys($node._meta.flags).length > 0));
    if (hasAttrsOrFlags) {
        return false;
    }

    /* find the _elem container for its children. */
    const container = $node._content.find(
        (c: unknown): c is HsonNode_NEW => is_Node_NEW(c) && c._tag === ELEM_TAG
    );
    
    /* the container must exist and have exactly one child */
    if (!container || container._content.length !== 1) {
        return false;
    }

    /* the single child must be a STRING_TAG or PRIM_TAG */
    const singleChild = container._content[0];
    return is_Node_NEW(singleChild) && (singleChild._tag === STR_TAG || singleChild._tag === VAL_TAG)
}

/**
 * get the primitive value from a self-closing node
 * @param {HsonNode_NEW} $node - the node suspected of being a BasicValue-carrier
 * @returns {Primitive | undefined} - undefined if the content does not match BasicValue carrying structure
 */
export function get_contentValue_NEW($node: HsonNode_NEW): Primitive | undefined {
    /* _val or _str nodes can't have attrs or flags */
    if ($node._meta?.attrs && Object.keys($node._meta.attrs).length > 0) {
        return undefined;
    }
    
    const container = $node._content.find((c: unknown): c is HsonNode_NEW => is_Node_NEW(c) && VSN_TAGS.includes(c._tag));
    
    /* the content is either in container._content or is in the direct child._content*/
    const contentSource = container ? container._content : $node._content;

    /* if there is exactly one child, and it's a BasicValue-carrying node, return its value */
    if (contentSource.length === 1) {
        const singleChild = contentSource[0];
        if (is_Node_NEW(singleChild) && (singleChild._tag === STR_TAG || singleChild._tag === VAL_TAG)) {
            return singleChild._content[0] as Primitive;
        }
    }

    return undefined;
}