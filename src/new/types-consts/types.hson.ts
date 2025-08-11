// base.hson.types.ts

/** union of primitive data types valid in both JSON and HSON */
export type Primitive = string | boolean | number | null;

export type BasicValue = boolean | number | null;

/** recursive type representing any valid json structur. */
export type JsonType =
    | Primitive
    // | { [key: string]: JsonType } /* replaced with JsonObj: */
    | JsonObj
    | JsonType[];

export type JsonType_NEW =
    | Primitive
    // | { [key: string]: JsonType } /* replaced with JsonObj: */
    | JsonObj_NEW
    | JsonType_NEW[];


/** represents a standard javascript object, extended with an optional _meta property */
export type JsonObj = { [key: string]: JsonType } & { _meta?: HsonMeta };

export type JsonObj_NEW = { [key: string]: JsonType_NEW } & { _meta?: HsonMeta_NEW, _attrs?: HsonAttrs_NEW };


/**
 * @typedef {object} HsonNode the universal, in-memory representation of all data within the hson system
 *      every format (html, json, hson) is parsed into this structure
 * @property {string} tag - the node's name (e.g., 'p', 'div') or its vsn type (e.g., '_obj', '_elem') -- corresponds to key
 * @property {NodeContent} content - array containing the node's children, which can be other hsonnodes or primitives -- corresponds to value
 * @property {HsonMeta} _meta - a container for attributes and flags (TODO- change to '_attrs')
 */

export interface HsonNode {
    _tag: string;
    _attrs?: HsonAttrs
    _content: NodeContent;
    _meta: HsonMeta;
}
export interface HsonNode_NEW {
    _tag: string;
    _attrs?: HsonAttrs_NEW;
    _content: NodeContent_NEW;
    _meta: HsonMeta_NEW;
}

/** content of an HsonNode is an array of HsonNodes or a primitive */
export type NodeContent = (HsonNode | Primitive)[];

export type NodeContent_NEW = (HsonNode_NEW | Primitive)[];

/**
 * @typedef {object} _Meta a container for HTML data that JSON cannot natively represent
 *  (something of a misnomer - rename to _attrs and wrap flags in - TODO)
 * @property {HsonAttrs} attrs - an object for html-style key-value attributes
 * @property {HsonFlags} flags - an array for html-boolean flags (flag="flag")
 */
export interface HsonMeta {
    flags: HsonFlags;
    attrs: HsonAttrs;
    'data-index'?: number;
    'data-quid'?: string;
}


/**
 * represents the HTML attributes property
 * the keys are strings, and the values are primitives.
 * TODO: flags will be subsumed into this; any flag is an attribute where key=value
 * @property {string} [data-index] - an optional, explicit index for items within an array.
 */
export type HsonAttrs = {
    'data-index'?: string; // deprecate
    'style'?: string | Record<string, string> // keep
} & Record<string, Primitive>;


/**
 * represents the HTML attributes property
 * the keys are strings, and the values are primitives.
 * TODO: flags will be subsumed into this; any flag is an attribute where key=value
 * @property {string} [data-index] - an optional, explicit index for items within an array.
 */
export type HsonAttrs_NEW = Record<string, Primitive>;


/**
 * represents the HTML attributes property
 * the keys are strings, and the values are primitives.
 * TODO: flags will be subsumed into this; any flag is an attribute where key=value
 * @property {string} [data-index] - an optional, explicit index for items within an array.
 */
export type HsonMeta_NEW = {
    'data-index'?: string;
    'style'?: string | Record<string, string> // keep
} & Record<string, Primitive>;

/* deprecated (see above) TODO */
export type HsonFlags = Array<string | Record<string, Primitive>>;
