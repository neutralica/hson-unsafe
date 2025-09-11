import { LiveTree_NEW } from "../api/livetree/live-tree-class.new.tree.hson";
import { JsonType } from "../core/types-consts/core.types.hson";
import { HsonAttrs_NEW, HsonMeta_NEW } from "./node.new.types.hson";



/* branch - unattached LiveTree created from passed data (HTML/JSON) 
    use a tree nodes's append() method to attach these */
export interface BranchConstructor_NEW {
  /* returns the created LiveTree instance as a detached "branch"
         ready to be appended to another tree */
  asBranch(): LiveTree_NEW;
}

/* graft: creating a tree from a live DOM element and replacing it in-DOM; 
    should only be called once and then append from then on */
// TODO TASK figure out how to not double-ingest trees
export interface GraftConstructor_NEW {
  /* replaces the target DOM element's content with the HSON-controlled version,
        and returns the interactive LiveTree */
    
  graft(): LiveTree_NEW; 
}

/* main source constructor */
export interface TreeConstructor_Source_NEW {
  /* for creating new tree content from data */
  fromHTML(htmlString: string): BranchConstructor_NEW;
  fromJSON(json: string | JsonType): BranchConstructor_NEW;
  fromHSON(hsonString: string): BranchConstructor_NEW; 

/* for targeting the existing DOM (not a LiveTree) and replcaing with graft() */
  queryDom(selector: string): GraftConstructor_NEW;
  queryBody(): GraftConstructor_NEW;
}
/*  defines the shape of the query object for find() and findAll() */

export interface HsonQuery_NEW {
  tag?: string;
  attrs?: Partial<HsonAttrs_NEW>;
  meta?: Partial<HsonMeta_NEW>;
  text?: string | RegExp;
}
