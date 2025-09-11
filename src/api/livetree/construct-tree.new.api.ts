// src/api/livetree/construct-tree.new.api.hson.ts

import { HsonNode, LiveTree, parse_html, parse_json, parse_hson } from "../..";
import { JsonType } from "../../core/types-consts/core.types";
import { _ERROR } from "../../types-consts/constants";
import { TreeConstructor_Source, BranchConstructor, GraftConstructor } from "../../types-consts/tree.new.types";
import { sanitize_html } from "../../utils/sanitize-html.utils";
import { create_live_tree_NEW } from "./create-live-tree.new.tree";
import { graft_NEW } from "./graft.new.tree";


/**
 * factory function that builds the entry-point for the liveTree pipeline
 * @param $options - an object to control behavior, e.g., { unsafe: boolean }
 * @returns an object with methods to define the source of the tree
 */
export function construct_tree_NEW(
  $options: { unsafe: boolean } = { unsafe: false }
): TreeConstructor_Source {

  /* internal helper to create a detached branch from a root node
      it builds the dom elements in memory but does not attach them */
  const createBranch = ($rootNode: HsonNode): LiveTree => {
    create_live_tree_NEW($rootNode); /* populate the NODE_ELEMENT_MAP */
    return new LiveTree($rootNode);
  };


  /* the main object returned by construct_tree */
  return {
    /* methods for creating detached branches from data */

    fromHTML($html: string): BranchConstructor {
      const cleanHtml = $options.unsafe ? $html : sanitize_html($html);
      const rootNode = parse_html(cleanHtml);
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },

    fromJSON($json: string | JsonType): BranchConstructor {
      const rootNode = parse_json($json as string);
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },


    fromHSON($hson: string): BranchConstructor {
      // assumes you have tokenize_hson and parse_tokens available
      const rootNode = parse_hson($hson);
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },

    /* --- methods for targeting and replacing live dom elements --- */

    queryDom($selector: string): GraftConstructor {
      const element = document.querySelector<HTMLElement>($selector);

      /* return the graft constructor object */
      return {
        graft: (): LiveTree => {
          /* the null check here inside the final method call */
          if (!element) {
            console.warn(`hson.liveTree.queryDom: selector "${$selector}" not found.`);
            /* return a new empty LiveTree to prevent errors and avoid the body default */
            return new LiveTree({ _tag: _ERROR, _content: [], _meta: {} });
          }
          // only call the main graft function if the element was found
          return graft_NEW(element, $options);
        }
      };
    },

    queryBody(): GraftConstructor {
      const element = document.body;

      /* return the graft constructor object */
      return {
        graft: (): LiveTree => {
          return graft_NEW(element, $options);
        }
      };
    },

  };
}