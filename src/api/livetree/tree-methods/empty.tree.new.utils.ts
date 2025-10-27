// empty.tree.utils.ts



import { is_Node } from "../../../utils/node-guards.new.utils";
import { HsonNode } from "../../../types-consts/node.new.types";
import { LiveTree } from "../live-tree-class.new.tree";
import { NODE_ELEMENT_MAP } from "../../../types-consts/constants";
import { detach_node_deep } from "../tree-utils/detach-node.tree.utils";

export function empty(this: LiveTree): LiveTree {
    const selectedNodes = (this as any).selectedNodes as HsonNode[];

    for (const node of selectedNodes) {
        const kids = node._content;
        if (!Array.isArray(kids) || kids.length === 0) continue;

        // 1) deep detach every child (listeners + DOM + map)
        for (const child of kids) {
            if (is_Node(child)) detach_node_deep(child);
        }

        // 2) set model content to empty
        node._content = [];

        // 3) ensure the element has no stray DOM children (paranoia; usually already gone)
        const el = NODE_ELEMENT_MAP.get(node);
        if (el) while (el.firstChild) el.removeChild(el.firstChild);
    }

    return this;
}