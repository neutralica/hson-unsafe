import { SourceConstructor_1 } from "../types-consts/constructors.types.hson.js";
import { construct_source_1 } from "./constructors/constructor-1-source.api.hson.js";
import { graft } from "./tree/graft.tree.hson.js";
import { HsonTree } from "./tree/hson-tree-class.tree.hson.js";

/** import hson 
 *    current methods: 
 *    - transform() (for simple conversions from format to format)
 *    - liveTree() (returns a manipulable JSON tree 'grafted' into the DOM)
 */

export const hson = {
  /**
   * the entry point for all stateless data transformations.
   *    returns a chainable object to convert between formats.
   * 
   * @param {HTMLElement | JsonShape | string}
   * @returns {SourceConstructor_1} (need to type this better) - the first stage of the conversion API 
   *   carries 'source' methods like 'fromHTML($html: string)`, `fromHSON($hson: string)`
   * @example 
   *   const rawJSON =  
   *     HSON.generate
   *      .fromHTML(string)
   *      .toJSON()
   *      .serialize()  //--- returns HTML in JSON form, with all structural VSNs
   */
  get transform(): SourceConstructor_1 {
    return construct_source_1(); // Your existing, working constructor
  },


  /**
   * - takes control of a live DOM element and replaces with a 'HsonTree'
   *    object (stripped of its structural VSN clutter) for querying & manipulation
   * - changes made to the data in JSON are instantly parsed and pushed to the HTML live tree
   * 
   * @param {HTMLElement} element - the node to replace with the liveTree; 
   * @returns {HsonTree} the JSON object + chainable methods to query and manipulate
   * usage ex: 
   *    const tree = HSON.tree().
   *    tree.find(...).setAttr(...);
   */
  liveTree: graft,
};