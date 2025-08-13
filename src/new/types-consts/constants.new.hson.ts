// consts.types.ts

import { HsonNode_NEW } from "./new.types.hson";




export const NEW_NEW_NODE = (partial: Partial<HsonNode_NEW> = {}): HsonNode_NEW => ({
  _tag: partial._tag ?? '', 
  _content: partial._content ?? [],
  _attrs: partial._attrs ?? {},
  _meta:  partial._meta ?? {},
});
