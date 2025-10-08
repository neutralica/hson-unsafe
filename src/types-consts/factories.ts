// consts.types.ts


import { HsonNode } from "./node.new.types";
import { TokenKind, ArraySymbol, CloseKind, RawAttr, Position, TokenOpen, TokenEnd, TokenArrayOpen, TokenArrayClose, TokenText, TokenEmptyObj } from "./tokens.new.types";

export const CREATE_NODE = (partial: Partial<HsonNode> = {}): HsonNode => ({
  _tag: partial._tag ?? '', 
  _content: partial._content ?? [],
  _attrs: partial._attrs ?? {},
  _meta:  partial._meta ?? {},
});

export const TOKEN_KIND = {
  OPEN: 'OPEN',
  CLOSE: 'CLOSE',
  ARR_OPEN: 'ARR_OPEN',
  ARR_CLOSE: 'ARR_CLOSE',
  TEXT: 'TEXT',
  EMPTY_OBJ: 'EMPTY_OBJ',
} as const;


// added
export const ARR_SYMBOL = {
  guillemet: 'guillemet',
  bracket: 'bracket',
} satisfies Record<ArraySymbol, ArraySymbol>;

// added
export const CLOSE_KIND = {
  obj: 'obj',
  elem: 'elem',
} satisfies Record<CloseKind, CloseKind>;

// Tiny factories (so your tokenizer never constructs shapes inline)
export const CREATE_OPEN_TOKEN = (tag: string, rawAttrs: RawAttr[], pos: Position): TokenOpen =>
  ({ kind: TOKEN_KIND.OPEN, tag, rawAttrs, pos });

export const CREATE_END_TOKEN = (close: CloseKind, pos: Position): TokenEnd =>
  ({ kind: TOKEN_KIND.CLOSE, close, pos });

export const CREATE_ARR_OPEN_TOKEN = (variant: ArraySymbol, pos: Position): TokenArrayOpen =>
  ({ kind: TOKEN_KIND.ARR_OPEN, symbol: variant, pos });

export const CREATE_ARR_CLOSE_TOKEN = (variant: ArraySymbol, pos: Position): TokenArrayClose =>
  ({ kind: TOKEN_KIND.ARR_CLOSE, symbol: variant, pos });

export const CREATE_TEXT_TOKEN = (raw: string, quoted: boolean | undefined, pos: Position): TokenText =>
  (quoted ? { kind: TOKEN_KIND.TEXT, raw, quoted: true, pos } : { kind: TOKEN_KIND.TEXT, raw, pos });

export const CREATE_EMPTY_OBJ_TOKEN = (raw: string, quoted: boolean | undefined, pos: Position): TokenEmptyObj =>
  (quoted ? { kind: TOKEN_KIND.EMPTY_OBJ, raw, quoted: true, pos } : { kind: TOKEN_KIND.EMPTY_OBJ, raw, pos });


