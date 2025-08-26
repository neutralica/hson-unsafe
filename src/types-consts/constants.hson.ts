// consts.types.ts

import { Primitive } from "../core/types-consts/core.types.hson.js";
import { CloseToken, OpenToken, SelfToken, AllTokens, BaseToken } from "./tokens.types.hson.js";
import { HsonNode } from "./node.types.hson.js";

/* factory to build a node from incomplete info */
export const NEW_NODE = (partial: Partial<HsonNode> = {}): HsonNode => ({
  _tag: partial._tag ?? '',
  _content: partial._content ?? [],
  _meta: {
    flags: partial._meta?.flags ?? [],
    attrs: partial._meta?.attrs ?? {},
  }
});

/* factory to build a token from incomplete info */
export const CREATE_TOKEN = (partial: BaseToken): AllTokens => ({
  type: partial.type,
  tag: partial.tag,
  content: partial.content,
  attrs: partial.attrs ?? {},
  flags: partial.flags ?? [],

});

/* starting empty _meta value */
export const BLANK_META = {
  attrs: {} as Record<string, Primitive>,
  flags: [] as string[],
};

/* sentinel value for unsuccess */
export const _FALSE = '_false' as const;
export type FALSE_TYPE = typeof _FALSE;

export const _ERROR = '_error' as const;

/* VSN tags & some common combinations */
export const STR_TAG = '_str' as const;
export const VAL_TAG = '_val' as const;
export const ROOT_TAG = '_root' as const;
export const II_TAG = '_ii' as const;
export const OBJ_TAG = '_obj' as const;
export const ARR_TAG = '_array' as const;
export const ELEM_TAG = '_elem' as const;


/**
 * defines all VSNs *except* <_root>
 **/
export const VSN_TAGS: string[] = [
  II_TAG, ARR_TAG, ELEM_TAG, OBJ_TAG, STR_TAG, VAL_TAG,
] as const;

/**
 * defines all VSNs *including* <_root>
 **/
export const EVERY_VSN: string[] = [
  II_TAG, ARR_TAG, ELEM_TAG, OBJ_TAG, STR_TAG, VAL_TAG, ROOT_TAG,
] as const;

export type VSNTag = typeof VSN_TAGS[number];


export const ELEM_OBJ_ARR = [ELEM_TAG, ARR_TAG, OBJ_TAG] as string[];
export const ELEM_OBJ = [ELEM_TAG, OBJ_TAG];

export type ElemObjType = typeof ELEM_TAG | typeof OBJ_TAG;
export type ElemObjArrType = typeof ELEM_OBJ_ARR;;

/* token types */
export const TokenΔ = {
  OPEN: 'open',
  CLOSE: 'close',
  SELF: 'self',
  ARRAY_OPEN: 'array-open',
  ARRAY_CONTENTS: 'array-contents',
  ARRAY_CLOSE: 'array-close',
  ELEM_OPEN: 'elem-open',
  ELEM_CONTENTS: 'elem-contents',
  ELEM_CLOSE: 'elem-close',
  OBJ_OPEN: 'object-open',
  OBJ_CONTENTS: 'object-contents',
  OBJ_CLOSE: 'object-close',
  STR_CONTENTS: '_str',
  VAL_CONTENTS: '_val',
} as const;

export const OBJ_OPEN = { type: TokenΔ.OBJ_OPEN } as BaseToken;
export const OBJ_CLOSE = { type: TokenΔ.OBJ_CLOSE } as BaseToken;
export const HSON_CLOSE = { type: TokenΔ.CLOSE } as CloseToken;


/* render constructor targets */
export const $HSON = 'hson' as const;
export const $JSON = 'json' as const;
export const $HTML = 'html' as const;
export const $NODES = 'nodes' as const;
export const RenderΔ = { HSON: $HSON, HTML: $HTML, JSON: $JSON, NODES: $NODES } as const;

export const HSON_FrameΔ = {
  GEN: 'generate',
  STD: 'standard',
  SUBSET: 'subset',
} as const;

/* liveTree reference map */
export const NODE_ELEMENT_MAP = new WeakMap<HsonNode, HTMLElement>();