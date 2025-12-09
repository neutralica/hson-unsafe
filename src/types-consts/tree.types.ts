import { LiveTree } from "../api/livetree/live-tree-class.tree";
import { JsonValue } from "../core/types-consts/core.types";
import { HsonAttrs, HsonMeta } from "./node.types";



/* branch - unattached LiveTree created from passed data (HTML/JSON) 
    use a tree nodes's append() method to attach these */
export interface BranchConstructor {
  /* returns the created LiveTree instance as a detached "branch"
         ready to be appended to another tree */
  asBranch(): LiveTree;
}

/* graft: creating a tree from a live DOM element and replacing it in-DOM; 
    should only be called once and then append from then on */
// TODO TASK figure out how to not double-ingest trees
export interface GraftConstructor {
  /* replaces the target DOM element's content with the HSON-controlled version,
        and returns the interactive LiveTree */
    
  graft(): LiveTree; 
}

/* main source constructor */
export interface TreeConstructor_Source {
  /* for creating new tree content from data */
  fromHTML(htmlString: string): BranchConstructor;
  fromJSON(json: string | JsonValue): BranchConstructor;
  fromHSON(hsonString: string): BranchConstructor; 

/* for targeting the existing DOM (not a LiveTree) and replcaing with graft() */
  queryDom(selector: string): GraftConstructor;
  queryBody(): GraftConstructor;
}

/*  defines the shape of the query object for find() and findAll() */

export interface HsonQuery {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  meta?: Partial<HsonMeta>;
  text?: string | RegExp;
}

export type TagName = keyof HTMLElementTagNameMap;