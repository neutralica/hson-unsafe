import { construct_tree } from "./api/constructors/construct-tree.api.hson.js";
import { construct_source_1_NEW } from "./new/api/constructors/constructor-1-source.new.api.hson.js";

(globalThis as any)._test_ON  = () => { (globalThis as any).test_new = true;  location.reload(); };
(globalThis as any)._test_OFF = () => { (globalThis as any).test_new = false; location.reload(); };

/** import hson 
 * current methods: 
 * - transform() (for simple conversions from format to format)
 * - liveTree() (returns a manipulable JSON tree 'grafted' into the DOM)
 * - unsafe (provides access to non-sanitized versions of the pipelines)
 */
export const hson = {
  /**
   * the entry point for all stateless data transformations
   * returns a chainable object to convert between formats
   * sanitizes html by default
   */
  get transform() {
    return construct_source_1_NEW({ unsafe: false });
  },

  /**
   * the entry point for the stateful dom interaction pipeline
   * returns a chainable object for creating and manipulating live trees
   * sanitizes html by default
   */
  get liveTree() {
    return construct_tree({ unsafe: false });
  },

  /**
   * provides access to unsafe, non-sanitized versions of the pipelines
   * use with trusted, developer-authored content only
   */
  UNSAFE: {
    /**
     * accesses the unsafe stateless data transformation pipeline
     */
    get transform() {
      return construct_source_1_NEW({ unsafe: true });
    },
    /**
     * accesses the unsafe stateful dom interaction pipeline
     */
    get liveTree() {
      return construct_tree({ unsafe: true });
    }
  },
  
  /**
   * stubbed out for future development
   */
  liveMap: {},
};