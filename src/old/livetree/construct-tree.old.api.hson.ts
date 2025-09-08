import { JsonType } from "../../core/types-consts/core.types.hson.js";
import { _ERROR, _FALSE } from "../../types-consts/constants.hson.js";
import { BLANK_META } from "../types/node-constants.old.js";
import { BranchConstructor, GraftConstructor, TreeConstructor_Source } from "../types/tree.old.types.hson.js";
import { sanitize_html } from "../../utils/sanitize-html.utils.hson.js";
import { parse_html } from "../../api/parsers/parse-html.transform.hson.js";
import { create_live_tree } from "./create-live-tree.old.tree.hson.js";
import { graft } from "./graft.old.tree.hson.js";
import { LiveTree } from "./live-tree-class.old.tree.hson.js";
import { HsonNode } from "../../types-consts/node.types.hson.js";
import { parse_hson } from "../../api/parsers/parse-hson.transform.hson.js";
import { parse_json } from "../../api/parsers/parse-json.transform.hson.js";
import { tree_converter } from "../../_refactor/_refactor-utils/lift-attrs.refactor.hson.js";

/**
 * factory function that builds the entry-point for the liveTree pipeline
 * @param $options - an object to control behavior, e.g., { unsafe: boolean }
 * @returns an object with methods to define the source of the tree
 */
export function construct_tree_OLD(
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
      const cleanHtml = $options.unsafe ? $html : sanitize_html($html);
      const rootNode = tree_converter(parse_html(cleanHtml));
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },

    fromJSON($json: string | JsonType): BranchConstructor {
      const rootNode = tree_converter(parse_json($json as string));
      const branch = createBranch(rootNode);
      return {
        asBranch: () => branch,
      };
    },


    fromHSON($hson: string): BranchConstructor {
      // assumes you have tokenize_hson and parse_tokens available
      const rootNode = tree_converter(parse_hson($hson));
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
            return new LiveTree({ _tag: _ERROR, _content: [], _meta: BLANK_META });
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