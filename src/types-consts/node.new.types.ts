// base.hson.types.ts


import { Primitive } from "../core/types-consts/core.types";
import { _DATA_INDEX, _DATA_QUID } from "./constants";


export type JsonType =
    | Primitive
    | JsonObj
    | JsonType[];


/** represents a standard javascript object, extended with an optional _meta property */

export type JsonObj = { [key: string]: JsonType } & { _meta?: HsonMeta, _attrs?: HsonAttrs };


export interface HsonNode {
    _tag: string;
    _meta: HsonMeta;
    _attrs?: HsonAttrs;
    _content: NodeContent;
}

/** content of an HsonNode is an array of HsonNodes or a primitive */
export type NodeContent = (HsonNode | Primitive)[];

/**
 * represents the HTML attributes property
 * the keys are strings, and the values are primitives.
 * TODO: flags will be subsumed into this; any flag is an attribute where key=value
 * @property {string} [style] - for capturing parsed style when applicable.
 */
export type HsonAttrs = {'style'?: string | Record<string, string> } & Record<string, Primitive>;


/**
 * represents the HTML attributes property
 * the keys are strings, and the values are primitives.
 * TODO: flags will be subsumed into this; any flag is an attribute where key=value
 * @property {string} [data-_index] - an optional, explicit index for items within an array.
 */
export type HsonMeta = {
    [_DATA_INDEX]?: string;
    [_DATA_QUID]?: string;
} & Record<string, string>;
