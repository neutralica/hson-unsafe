// unwrap-obj.util.ts

import { ARR_TAG, ELEM_TAG, OBJ_TAG, ROOT_TAG } from "../../types-consts/constants";
import { CREATE_NODE } from "../../types-consts/factories";
import { HsonNode } from "../../types-consts/node.new.types";
import { is_Node } from "../node-utils/node-guards.new.utils";



export function unwrap_root_obj(node: HsonNode): HsonNode {
  if (node._tag !== ROOT_TAG) return node;

  const kids = (node._content ?? []).filter(is_Node) as HsonNode[];
  if (kids.length === 0) {
    // canonical empty object cluster as the item
    return CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [] });
  }
  if (kids.length === 1) {
    const k = kids[0];
    if (k._tag === OBJ_TAG || k._tag === ARR_TAG || k._tag === ELEM_TAG) return k;
    // single non-cluster: box it so the item stays structural
    return CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: [k] });
  }
  // multiple clusters under implicit root → normalize as an object cluster
  return CREATE_NODE({ _tag: OBJ_TAG, _meta: {}, _content: kids });
}