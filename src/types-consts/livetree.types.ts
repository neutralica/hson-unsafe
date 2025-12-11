// livetree2.types.ts

import { LiveTree } from "../api/livetree/livetree";
import { CssHandle } from "../api/livetree/livetree-methods/css-manager";
import { DataManager2 } from "../api/livetree/livetree-methods/data-manager2.tree";
import { StyleManager2 } from "../api/livetree/livetree-methods/style-manager2.utils";
import { ListenerBuilder } from "./listen.types";
import { HsonAttrs, HsonMeta, HsonNode } from "./node.types";

export interface HsonQuery {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  meta?: Partial<HsonMeta>;
  text?: string | RegExp;
}


export interface NodeRef {
  q: string;                        // QUID
  resolveNode(): HsonNode | undefined;
  resolveElement(): Element | undefined;
}

// Callable finder set (like your current FindWithById)
export interface FindWithById {
  (q: HsonQuery | string): LiveTree | undefined;
  byId(id: string): LiveTree | undefined;
  must(q: HsonQuery | string, label?: string): LiveTree;
  mustById(id: string, label?: string): LiveTree;
}

export interface LiveTreeCreateAppend {
  (tag: TagName, index?: number): LiveTree;
  (tags: TagName[], index?: number): TreeSelector;
}

export type TagName = keyof HTMLElementTagNameMap;
//  thin wrapper around an array of LiveTree2 with a limited,
// broadcast-style API. This is the “multi”/selector type.

export interface TreeSelector {
    // collection-ish surface
    toArray(): LiveTree[];
    forEach(fn: (tree: LiveTree, index: number) => void): void;
    map<T>(fn: (tree: LiveTree, index: number) => T): T[];
    count(): number;
    at(index: number): LiveTree | undefined;

    // attrs: broadcast to all trees, but keep the selector for chaining
    setAttrs(
        name: string,
        value: string | boolean | null
    ): TreeSelector;
    setAttrs(
        map: Record<string, string | boolean | null>
    ): TreeSelector;
    removeAttr(name: string): TreeSelector;

    // flags: broadcast to all trees
    setFlags(...names: string[]): TreeSelector;
    removeFlags(...names: string[]): TreeSelector;

    // style: proxied to the *first* tree; throws on empty
    readonly style: StyleManager2;
    readonly css: CssHandle;
    readonly data: DataManager2;
    readonly listen: ListenerBuilder;


    // structural sugar: create children under each selected tree and
    // keep returning the same selector
    createTag(tag: TagName | TagName[]): TreeSelector;
}



