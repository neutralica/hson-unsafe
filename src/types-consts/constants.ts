// consts.types.ts

import { BaseToken_NEW } from "./tokens.new.types.hson";


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
export const ARR_TAG = '_arr' as const;
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

