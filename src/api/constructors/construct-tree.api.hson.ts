import { HsonNode, JSONShape } from "../../types-consts/base.types.hson.js";
import { BLANK_META } from "../../types-consts/constants.types.hson.js";
import { BranchConstructor, GraftConstructor, TreeConstructor_Source } from "../../types-consts/tree.types.hson.js";
import { sanitize_html } from "../../utils/sanitize-html.utils.hson.js";
import { parse_html } from "../parsers/parse-html.transform.hson.js";
import { parse_json } from "../parsers/parse-json.transform.hson.js";
import { create_live_tree } from "../tree/create-live-tree.tree.hson.js";
import { LiveTree } from "../tree/live-tree-class.tree.hson.js";

/**
 * factory function that builds the entry-point for the liveTree pipeline
 * @param $options - an object to control behavior, e.g., { unsafe: boolean }
 * @returns an object with methods to define the source of the tree
 */
export function construct_tree(
    $options: { unsafe: boolean } = { unsafe: false } 
  ): TreeConstructor_Source {
  
    /* internal helper to create a detached branch from a root node
        it builds the dom elements in memory but does not attach them */
    const createBranch = ($rootNode: HsonNode): LiveTree => {
      create_live_tree($rootNode); /* populate the NODE_ELEMENT_MAP */
      return new LiveTree($rootNode);
    };
  
    /* the main object returned by construct_tree */
    return {
      /* --- methods for creating detached branches from data --- */
  
      fromHTML($htmlString: string): BranchConstructor {
        const cleanHtml = $options.unsafe ? $htmlString : sanitize_html($htmlString);
        const rootNode = parse_html(cleanHtml);
        const branch = createBranch(rootNode);
        return {
          asBranch: () => branch,
        };
      },
  
      fromJSON($json: string | JSONShape): BranchConstructor {
        const rootNode = parse_json($json as string);
        const branch = createBranch(rootNode);
        return {
          asBranch: () => branch,
        };
      },
  
      /* --- methods for targeting and replacing live dom elements --- */
  
      queryDom($selector: string): GraftConstructor {
        const element = document.querySelector($selector);
        return {
          graft: (): LiveTree => {
            if (!element) {
              // handle case where element is not found, return an empty tree
              console.warn(`hson.liveTree.queryDOM: selector "${$selector}" not found.`);
              return new LiveTree({ tag: '_elem', content: [], _meta: BLANK_META });
            }
            const html = element.innerHTML;
            const cleanHtml = $options.unsafe ? html : sanitize_html(html);
            const rootNode = parse_html(cleanHtml);
            const branch = createBranch(rootNode);
            
            // perform the graft operation
            const branchElement = branch.domElement();
            if (branchElement) {
              element.innerHTML = '';
              element.appendChild(branchElement);
            }
            return branch;
          },
        };
      },
  
      queryBody(): GraftConstructor {
        const element = document.body;
        return {
            graft: (): LiveTree => {
                const html = element.innerHTML;
                const cleanHtml = $options.unsafe ? html : sanitize_html(html);
                const rootNode = parse_html(cleanHtml);
                const branch = createBranch(rootNode);
  
                const branchElement = branch.domElement();
                if (branchElement) {
                    element.innerHTML = '';
                    element.appendChild(branchElement);
                }
                return branch;
            }
        };
      },
    };
  }