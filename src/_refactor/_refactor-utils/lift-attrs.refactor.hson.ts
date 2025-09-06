// _refactor/_seams/to-old-for-tree.seam.ts
import { HsonNode } from "../../types-consts/node.types.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";

export function tree_converter(root: HsonNode_NEW): HsonNode {
  return walk(root);

  function walk(n: HsonNode_NEW): HsonNode {
    // 1) meta: start from NEW _meta, or empty
    const meta: any = n._meta ? { ...n._meta } : {};

    // 2) attrs: merge NEW _attrs over any existing meta.attrs
    const mergedAttrs: Record<string, unknown> = {
      ...(meta.attrs || {}),
      ...(n._attrs || {}),
    };
    if (Object.keys(mergedAttrs).length) meta.attrs = mergedAttrs;

    // 3) flags: synth from boolean-ish attrs + keep existing
    const startFlags = Array.isArray(meta.flags) ? meta.flags : [];
    const flags = new Set<string>(startFlags);
    for (const [k, v] of Object.entries(n._attrs || {})) {
      if (v === "" || v === true || (typeof v === "string" && v.toLowerCase() === k.toLowerCase())) {
        flags.add(k);
      }
    }
    if (flags.size) meta.flags = Array.from(flags);

    // 4) content: convert child nodes; primitives pass through
    const content: any[] = (n._content || []).map(c => (is_Node_NEW(c) ? walk(c) : c));

    // 5) OLD node: no `_attrs` field in the result
    return { _tag: n._tag as any, _content: content, _meta: meta } as HsonNode;
  }
}
