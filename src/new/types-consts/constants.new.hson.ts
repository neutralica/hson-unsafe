// consts.types.ts

import { HsonNode_NEW } from "./node.new.types.hson";
import { ArraySymbol, CloseKind, Position, RawAttr, Tokens_NEW, TokenArrayClose_NEW, TokenArrayOpen_NEW, TokenEnd_NEW, TokenKind, TokenOpen_NEW, TokenText_NEW } from "./tokens.new.types.hson";

export const _META_DATA_PREFIX = 'data-_';

export const NEW_NEW_NODE = (partial: Partial<HsonNode_NEW> = {}): HsonNode_NEW => ({
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
} satisfies Record<TokenKind, TokenKind>;



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
export const NEW_OPEN_TOKEN = (tag: string, rawAttrs: RawAttr[], pos: Position): TokenOpen_NEW =>
  ({ kind: TOKEN_KIND.OPEN, tag, rawAttrs, pos });

export const NEW_END_TOKEN = (close: CloseKind, pos: Position): TokenEnd_NEW =>
  ({ kind: TOKEN_KIND.CLOSE, close, pos });

export const NEW_ARR_OPEN_TOKEN = (variant: ArraySymbol, pos: Position): TokenArrayOpen_NEW =>
  ({ kind: TOKEN_KIND.ARR_OPEN, symbol: variant, pos });

export const NEW_ARR_CLOSE_TOKEN = (variant: ArraySymbol, pos: Position): TokenArrayClose_NEW =>
  ({ kind: TOKEN_KIND.ARR_CLOSE, symbol: variant, pos });

export const NEW_TEXT_TOKEN = (raw: string, quoted: boolean | undefined, pos: Position): TokenText_NEW =>
  (quoted ? { kind: TOKEN_KIND.TEXT, raw, quoted: true, pos } : { kind: TOKEN_KIND.TEXT, raw, pos });