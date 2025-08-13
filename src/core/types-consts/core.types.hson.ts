// types.core.hson.ts

/** union of primitive data types valid in both JSON and HSON */
export type Primitive = string | boolean | number | null;

export type BasicValue = boolean | number | null;

/** recursive type representing any valid json structur. */
export type JsonType =
    | Primitive
    // | { [key: string]: JsonType } /* replaced with JsonObj: */
    | JsonObj
    | JsonType[];


/** represents a standard javascript object, extended with an optional _meta property */
export type JsonObj = { [key: string]: JsonType };

