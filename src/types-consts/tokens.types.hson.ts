import { TokenΔ } from "./constants.hson.js";
import { HsonAttrs as HsonAttrs, HsonFlags, HsonNode, Primitive } from "./types.hson.js";


export interface BaseToken {
    /** Discriminator */
    type: HSON_Token_Type;
    /** Tag name or JSON key */
    tag?: string;
    /** Quoted‐string content (for text nodes), otherwise an empty array */
    content?: Primitive[];
    /** Inline flags or text values */
    flags?: HsonFlags;
    /** Parsed key→value attributes */
    attrs?: HsonAttrs;
    quoted?: boolean;
}

/* self-closing token (one-line tag) */
export interface SelfToken extends BaseToken {
    type: typeof TokenΔ.SELF;
};

export interface CloseToken extends BaseToken {
    type: typeof TokenΔ.CLOSE;
};

export interface OpenToken extends BaseToken {
    type: typeof TokenΔ.OPEN;
}

export interface ArrayOPENToken extends BaseToken {
    type: typeof TokenΔ.ARRAY_OPEN;
}

export interface ArrayCLOSEToken extends BaseToken {
    type: typeof TokenΔ.ARRAY_CLOSE;
}
export interface ArrayCONTENTSToken extends BaseToken {
    type: typeof TokenΔ.ARRAY_CONTENTS;
}

export interface ListOPENToken extends BaseToken {
    type: typeof TokenΔ.ELEM_OPEN;
}

export interface ListCLOSEToken extends BaseToken {
    type: typeof TokenΔ.ELEM_CLOSE;
}
export interface ListCONTENTSToken extends BaseToken {
    type: typeof TokenΔ.ELEM_CONTENTS;
}

export interface ObjectOPENToken extends BaseToken {
    type: typeof TokenΔ.OBJ_OPEN;
}

export interface ObjectCLOSEToken extends BaseToken {
    type: typeof TokenΔ.OBJ_CLOSE;
}
export interface ObjectCONTENTSToken extends BaseToken {
    type: typeof TokenΔ.OBJ_CONTENTS;
}

export type AllTokens =
    | BaseToken
    | OpenToken
    | SelfToken
    | CloseToken
    | ArrayCLOSEToken
    | ArrayCONTENTSToken
    | ArrayOPENToken
    | ObjectOPENToken
    | ListCLOSEToken
    | ListCONTENTSToken
    | ListOPENToken
    | ObjectOPENToken
    | ObjectCONTENTSToken
    | ObjectCLOSEToken
    ;


export type HSON_Token_Type = (typeof TokenΔ)[keyof typeof TokenΔ];
