// consts.types.ts

import { HsonNode, HsonNode_NEW, Primitive } from "./types.hson.js";
import { CloseToken, OpenToken, SelfToken, AllTokens, BaseToken } from "./tokens.types.hson.js";

/* factory to build a node from incomplete info */
export const NEW_NODE = (partial: Partial<HsonNode> = {}): HsonNode => ({
  _tag: partial._tag ?? '', 
  _content: partial._content ?? [],
  _meta: {
    flags: partial._meta?.flags ?? [],
    attrs: partial._meta?.attrs ?? {},
  }
});

export const NEW_NEW_NODE = (partial: Partial<HsonNode_NEW> = {}): HsonNode_NEW => ({
  _tag: partial._tag ?? '', 
  _content: partial._content ?? [],
  _attrs: partial._attrs ?? {},
  _meta:  partial._meta ?? {},
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
export const STRING_TAG = '_str' as const;
export const VAL_TAG = '__val' as const;
export const ROOT_TAG = '_root' as const;
export const INDEX_TAG = '_ii' as const;
export const OBJECT_TAG = '_obj' as const;
export const ARRAY_TAG = '_array' as const;
export const ELEM_TAG = '_elem' as const;


/* these are important; keep */
export const VSN_TAGS = [
  INDEX_TAG,
  ARRAY_TAG,
  ELEM_TAG,
  OBJECT_TAG,
  STRING_TAG,
  VAL_TAG,
] as string[];
export const VSNContainerTags = VSN_TAGS;

export const ELEM_OBJ_ARR = [ELEM_TAG, ARRAY_TAG, OBJECT_TAG] as string[];
export const ELEM_OBJ = [ELEM_TAG, OBJECT_TAG];

export type ElemObjType = typeof ELEM_TAG | typeof OBJECT_TAG;
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
  STR_VAL: '_str',
  PRIM_VAL: '_prim',
} as const;

export const OBJ_OPEN = { type: TokenΔ.OBJ_OPEN } as BaseToken;
export const OBJ_CLOSE = { type: TokenΔ.OBJ_CLOSE } as BaseToken;
export const HSON_CLOSE = { type: TokenΔ.CLOSE } as CloseToken;


/* render constructor targets */
export const $HSON = 'hson' as const;
export const $JSON = 'json' as const;
export const $HTML = 'html' as const;
export const $NODES = 'nodes' as const;
export const RenderΔ = {HSON: $HSON, HTML: $HTML, JSON: $JSON, NODES: $NODES} as const;

export const HSON_FrameΔ = {
  GEN: 'generate',
  STD: 'standard',
  SUBSET: 'subset',
} as const;

/* liveTree reference map */
export const NODE_ELEMENT_MAP = new WeakMap<HsonNode, HTMLElement>();