// base.hson.types.ts

import { Primitive } from "../../core/types-consts/core.types.hson";


export type JsonType_NEW =
    | Primitive
    | JsonObj_NEW
    | JsonType_NEW[];


/** represents a standard javascript object, extended with an optional _meta property */

export type JsonObj_NEW = { [key: string]: JsonType_NEW } & { _meta?: HsonMeta_NEW, _attrs?: HsonAttrs_NEW };


export interface HsonNode_NEW {
    _tag: string;
    _attrs?: HsonAttrs_NEW;
    _content: NodeContent_NEW;
    _meta: HsonMeta_NEW;
}

/** content of an HsonNode is an array of HsonNodes or a primitive */
export type NodeContent_NEW = (HsonNode_NEW | Primitive)[];

/**
 * represents the HTML attributes property
 * the keys are strings, and the values are primitives.
 * TODO: flags will be subsumed into this; any flag is an attribute where key=value
 * @property {string} [data-index] - an optional, explicit index for items within an array.
 */
export type HsonAttrs_NEW = {'style'?: string | Record<string, string> } & Record<string, Primitive>;


/**
 * represents the HTML attributes property
 * the keys are strings, and the values are primitives.
 * TODO: flags will be subsumed into this; any flag is an attribute where key=value
 * @property {string} [data-index] - an optional, explicit index for items within an array.
 */
export type HsonMeta_NEW = {
    'data-_index'?: string;
    'data-_quid'?: string;
} & Record<string, string>;
