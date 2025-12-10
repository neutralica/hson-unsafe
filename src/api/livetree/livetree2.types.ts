// livetree2.types.ts

import { HsonNode, HsonQuery, Primitive } from "../../types-consts";
import { TagName } from "../../types-consts/tree.types";
import { LiveTree } from "./livetree";
import { TreeSelector } from "./tree-selector";
// import existing helpers instead of re-implementing:
// import { getElementForNode } from "../../node-element-map";
// import { ensure_quid } from "../../utils/quid-utils";

export interface NodeRef2 {
  q: string;                        // QUID
  resolveNode(): HsonNode | undefined;
  resolveElement(): Element | undefined;
}

// Callable finder set (like your current FindWithById)
export interface FindWithById2 {
  (q: HsonQuery | string): LiveTree | undefined;
  byId(id: string): LiveTree | undefined;
  must(q: HsonQuery | string, label?: string): LiveTree;
  mustById(id: string, label?: string): LiveTree;
}



// LiveTree2.createAppend call shape
// export interface LiveTreeCreateAppend {
//   (this: LiveTree2, tag: TagName | TagName[]): CreateAppendResult;
//   (this: LiveTree2, tag: TagName | TagName[], index: number): LiveTree2;
// }

export interface LiveTreeCreateAppend {
  (tag: TagName, index?: number): LiveTree;
  (tags: TagName[], index?: number): TreeSelector;
}



