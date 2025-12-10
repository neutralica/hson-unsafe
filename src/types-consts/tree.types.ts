import { HsonAttrs, HsonMeta } from "./node.types";

export interface HsonQuery {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  meta?: Partial<HsonMeta>;
  text?: string | RegExp;
}

export type TagName = keyof HTMLElementTagNameMap;