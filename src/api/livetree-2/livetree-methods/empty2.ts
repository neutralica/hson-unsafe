// empty.tree.utils.ts



import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { HsonNode } from "../../../types-consts/node.types";
import { NODE_ELEMENT_MAP } from "../../../types-consts/constants";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node.tree.utils";
import { getElementForNode } from "../../../utils/tree-utils/node-map-helpers.utils";
import { LiveTree2 } from "../livetree2";

export function empty2(this: LiveTree2): LiveTree2 {
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
        const el = getElementForNode(node);
        if (el) while (el.firstChild) el.removeChild(el.firstChild);
    }

    return this;
}