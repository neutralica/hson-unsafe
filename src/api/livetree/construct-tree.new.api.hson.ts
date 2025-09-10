// src/api/livetree/construct-tree.new.api.hson.ts

import { JsonType } from "../../core/types-consts/core.types.hson";
import { _ERROR } from "../../types-consts/constants.hson";
import { sanitize_html } from "../../utils/sanitize-html.utils.hson";
import { parse_html } from "../parsers/parse-html.new.transform.hson";
import { parse_json } from "../parsers/parse-json.new.transform.hson";
import { parse_hson } from "../parsers/parse-hson.new.transform.hson";
import { create_live_tree_NEW } from "./create-live-tree.new.tree.hson";
import { graft_NEW } from "./graft.new.tree.hson";
import { LiveTree_NEW } from "./live-tree-class.new.tree.hson";
import { BranchConstructor_NEW, GraftConstructor_NEW, TreeConstructor_Source_NEW } from "../../types-consts/tree.new.types.hson";
import { HsonNode_NEW } from "../../types-consts/node.new.types.hson";


/**
 * factory function that builds the entry-point for the liveTree pipeline
 * @param $options - an object to control behavior, e.g., { unsafe: boolean }
 * @returns an object with methods to define the source of the tree
 */
export function construct_tree_NEW(
  $options: { unsafe: boolean } = { unsafe: false }
): TreeConstructor_Source_NEW {

  /* internal helper to create a detached branch from a root node
      it builds the dom elements in memory but does not attach them */
  const createBranch = ($rootNode: HsonNode_NEW): LiveTree_NEW => {
    create_live_tree_NEW($rootNode); /* populate the NODE_ELEMENT_MAP */
    return new LiveTree_NEW($rootNode);
  };


  /* the main object returned by construct_tree */
  return {
    /* methods for creating detached branches from data */

    fromHTML($html: string): BranchConstructor_NEW {
      const cleanHtml = $options.unsafe ? $html : sanitize_html($html);
      const rootNode = parse_html(cleanHtml);
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },

    fromJSON($json: string | JsonType): BranchConstructor_NEW {
      const rootNode = parse_json($json as string);
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },


    fromHSON($hson: string): BranchConstructor_NEW {
      // assumes you have tokenize_hson and parse_tokens available
      const rootNode = parse_hson($hson);
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },

    /* --- methods for targeting and replacing live dom elements --- */

    queryDom($selector: string): GraftConstructor_NEW {
      const element = document.querySelector<HTMLElement>($selector);

      /* return the graft constructor object */
      return {
        graft: (): LiveTree_NEW => {
          /* the null check here inside the final method call */
          if (!element) {
            console.warn(`hson.liveTree.queryDom: selector "${$selector}" not found.`);
            /* return a new empty LiveTree to prevent errors and avoid the body default */
            return new LiveTree_NEW({ _tag: _ERROR, _content: [], _meta: {} });
          }
          // only call the main graft function if the element was found
          return graft_NEW(element, $options);
        }
      };
    },

    queryBody(): GraftConstructor_NEW {
      const element = document.body;

      /* return the graft constructor object */
      return {
        graft: (): LiveTree_NEW => {
          return graft_NEW(element, $options);
        }
      };
    },

  };
}