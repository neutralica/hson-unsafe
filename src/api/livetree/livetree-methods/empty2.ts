// empty.ts

import { HsonNode } from "../../../types-consts";
import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { detach_node_deep } from "../../../utils/tree-utils/detach-node.tree.utils";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers.utils";
import { LiveTree } from "../livetree";

export function empty2(this: LiveTree): LiveTree {
    const node = this.node;

    const kids = node._content;

    // 1) deep detach every child (listeners + DOM + map)
    for (const child of kids) {
        if (is_Node(child)) detach_node_deep(child);
    }

    // 2) set model content to empty
    node._content = [];

    // 3) ensure the element has no stray DOM children (paranoia; usually already gone)
    const el = element_for_node(node);
    if (el) while (el.firstChild) el.removeChild(el.firstChild);
    return this;
}

