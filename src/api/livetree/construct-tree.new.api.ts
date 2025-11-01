// src/api/livetree/construct-tree.new.api.hson.ts

import { JsonType } from "../../core/types-consts/core.types";
import { HsonNode } from "../../types-consts";
import { _ERROR } from "../../types-consts/constants";
import { TreeConstructor_Source, BranchConstructor, GraftConstructor } from "../../types-consts/tree.new.types";
import { parse_hson } from "../parsers/parse-hson.new.transform";
import { parse_html } from "../parsers/parse-html.new.transform";
import { parse_json } from "../parsers/parse-json.new.transform";
import { create_live_tree } from "./create-live-tree.new.tree";
import { graft } from "./graft.new.tree";
import { LiveTree } from "./live-tree-class.new.tree";


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
    /* methods for creating detached branches from data */

    fromHTML($html: string): BranchConstructor {
      const rootNode = parse_html($html);
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
          return graft(element, $options);
        }
      };
    },

    queryBody(): GraftConstructor {
      const element = document.body;

      /* return the graft constructor object */
      return {
        graft: (): LiveTree => {
          return graft(element, $options);
        }
      };
    },

  };
}