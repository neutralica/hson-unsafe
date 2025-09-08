import { Primitive } from "../../core/types-consts/core.types.hson";
import { HsonNode } from "../../types-consts/node.types.hson";

/* factory to build a node from incomplete info */

export const NEW_NODE = (partial: Partial<HsonNode> = {}): HsonNode => ({
  _tag: partial._tag ?? '',
  _content: partial._content ?? [],
  _meta: {
    flags: partial._meta?.flags ?? [],
    attrs: partial._meta?.attrs ?? {},
  }
});
/* starting empty _meta value */

export const BLANK_META = {
  attrs: {} as Record<string, Primitive>,
  flags: [] as string[],
};/* liveTree reference map */

export const NODE_ELEMENT_MAP = new WeakMap<HsonNode, HTMLElement>();

