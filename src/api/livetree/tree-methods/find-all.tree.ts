// find-all.tree.ts

import { HsonQuery } from "../../../types-consts";
import { parseSelector } from "../../../utils/tree-utils/parse-selector.utils";
import { LiveTree } from "../live-tree-class.new.tree";

/* 
  findAll(q: HsonQuery | string): LiveTree {
    const query = typeof q === 'string' ? parseSelector_NEW(q) : q;
    const found = this.search(this.selectedNodes, query, { findFirst: false });
    return new LiveTree(found);
  }
 */
