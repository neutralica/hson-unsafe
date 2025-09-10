import { HsonAttrs_NEW, HsonMeta_NEW } from "./node.new.types.hson";

/*  defines the shape of the query object for find() and findAll() */

export interface HsonQuery_NEW {
  tag?: string;
  attrs?: Partial<HsonAttrs_NEW>;
  meta?: Partial<HsonMeta_NEW>;
  text?: string | RegExp;
}


