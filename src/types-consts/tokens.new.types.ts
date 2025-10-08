// tokens.new.types.ts

import { TOKEN_KIND } from "./factories";



/* Position is lightweight; expand later if end positions needed */
export type Position = { line: number; col: number; index: number };

export type RawAttr = {
  name: string;
  value?: { text: string; quoted: boolean };
  start: Position;
  end: Position;
};


export interface BaseToken {
  /** Discriminator */
  kind: TokenKind;
  /** Tag name or JSON key */
  tag?: string;
  /** Parsed key→value attributes */
  rawAttrs?: RawAttr[];
  quoted?: boolean;
  pos?: Position;
}

/* new refactor types: */
export type TokenKind =
  | 'OPEN' | 'CLOSE'
  | 'ARR_OPEN' | 'ARR_CLOSE'
  | 'TEXT';

export type CloseKind = 'obj' | 'elem';

export type ArraySymbol = 'guillemet' | 'bracket';

export type TokenOpen = {
  kind: typeof TOKEN_KIND.OPEN; /* was: 'TAG_OPEN' */
  tag: string;
  rawAttrs: RawAttr[];
  pos: Position;
};

export type TokenEnd = {
  kind: typeof TOKEN_KIND.CLOSE;  /* was: 'TAG_END' */
  close: CloseKind;               /* was: 'obj' | 'elem' */
  pos: Position;
};

export type TokenArrayOpen = {
  kind: typeof TOKEN_KIND.ARR_OPEN;
  symbol: ArraySymbol;          /* was: 'guillemet' | 'bracket' */
  pos: Position;
};

export type TokenArrayClose = {
  kind: typeof TOKEN_KIND.ARR_CLOSE;
  symbol: ArraySymbol;
  pos: Position;
};

export type TokenText = {
  kind: typeof TOKEN_KIND.TEXT;
  raw: string;
  quoted?: boolean;
  pos: Position;
};

export type TokenEmptyObj = {
  kind: typeof TOKEN_KIND.EMPTY_OBJ;
  raw: string;
  quoted?: boolean;
  pos: Position;
};

export type Tokens =
  | TokenOpen | TokenEnd
  | TokenArrayOpen | TokenArrayClose
  | TokenText | TokenEmptyObj;
