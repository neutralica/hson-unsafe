import { LiveTree } from "hson-live/types";
// dom.ts

// helper types for “callable with .must”
export type ClosestFn = ((sel: string) => LiveTree | undefined) & {
  must: (sel: string, label?: string) => LiveTree;
};

export type ParentFn = (() => LiveTree | undefined) & {
  must: (label?: string) => LiveTree;
};

export interface LiveTreeDom {
  el(): Element | undefined;
  html(): HTMLElement | undefined;
  matches(sel: string): boolean;
  contains(other: LiveTree): boolean;

  // CHANGED: single declarations using intersection types
  closest: ClosestFn;
  parent: ParentFn;
}