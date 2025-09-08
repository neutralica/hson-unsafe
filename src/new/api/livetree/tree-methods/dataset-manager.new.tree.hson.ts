// src/utils/style-manager.utils.hson.ts

import { Primitive } from "../../../../core/types-consts/core.types.hson";
import { LiveTree_NEW } from "../live-tree-class.new.tree.hson";



/**
 * expedites interaction and manipulation of the .dataset property 
 * data attributes can be set one-by-one or (TODO) in an object
 */
export class DatasetManager_NEW {
    private liveTree: LiveTree_NEW;

    constructor(liveTree: LiveTree_NEW) {
        this.liveTree = liveTree;
    }

    /**
     * set `data-*` attribute on selected nodes
     * @param key key in kebab (e.g., 'userId' becomes 'data-user-id').
     * @param value new value 
     * 
     * *** note - this is not a typo for _META_DATA_PREFIX - do not change *** 
     */
    set(key: string, value: string | null): LiveTree_NEW {
        const dataAttrName = `data-${key}`;
        this.liveTree.setAttr(dataAttrName, value);
        return this.liveTree;
    }

    /**
     * get a `data-*` attribute from the first selected node
     * @param key the data attribute's key
     * 
     * * *** note - this is not a typo for _META_DATA_PREFIX - do not change*** 
     * 
     */
    get(key: string): Primitive | undefined {
        const dataAttrName = `data-${key}`;
        return this.liveTree.getAttr(dataAttrName);
    }
}
