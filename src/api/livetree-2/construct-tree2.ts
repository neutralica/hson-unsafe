// src/api/livetree/construct-tree.new.api.hson.ts

import { JsonValue } from "../../core/types-consts/core.types";
import { HsonNode } from "../../types-consts";
import { _ERROR } from "../../types-consts/constants";
import { isSvgMarkup, node_from_svg } from "../../utils/node-utils/node-from-svg.utils";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { parse_external_html } from "../parsers/parse-external-html.transform";
import { parse_hson } from "../parsers/parse-hson.new.transform";
import { parse_html } from "../parsers/parse-html.new.transform";
import { parse_json } from "../parsers/parse-json.new.transform";
import { createBranchFromNode2 } from "./create-branch2";
import { graft2 } from "./graft2.tree";
import { LiveTree2 } from "./livetree2";
import { BranchConstructor2, GraftConstructor2, TreeConstructor_Source2 } from "./livetree2.types";

/**
 * factory function that builds the entry-point for the liveTree pipeline
 * @param $options - an object to control behavior, e.g., { unsafe: boolean }
 * @returns an object with methods to define the source of the tree
 */
export function construct_tree2(
  $options: { unsafe: boolean } = { unsafe: false }
): TreeConstructor_Source2 {

  /* the main object returned by construct_tree */
  return {
    /* methods for creating detached branches from data */
    fromHTML($html: string): BranchConstructor2 {
      let node: HsonNode;

      const trimmed = $html.trimStart();

      if (isSvgMarkup(trimmed)) {
        if (!$options.unsafe) {
          // SAFE pipeline: SVG from external HTML is not allowed
          _throw_transform_err(
            "liveTree.fromHTML(): SVG markup is only allowed on UNSAFE pipeline or via internal node_from_svg.",
            "liveTree.fromHTML",
            $html.slice(0, 200)
          );
        }

        // UNSAFE: legacy SVG path (internal demo content)
        const el = new DOMParser()
          .parseFromString($html, "image/svg+xml")
          .documentElement;
        node = node_from_svg(el);
      } else {
        // NON-SVG HTML: safe pipeline → sanitized; unsafe → raw
        node = $options.unsafe
          ? parse_html($html)
          : parse_external_html($html);
      }

      const branch = createBranchFromNode2(node);
      return {
        asBranch: () => branch,
      };
    },

    fromJSON($json: string | JsonValue): BranchConstructor2 {
      const rootNode = parse_json($json as string);
      const branch = createBranchFromNode2(rootNode);
      return {
        asBranch: () => branch,
      };
    },


    fromHSON($hson: string): BranchConstructor2 {
      // assumes tokenize_hson and parse_tokens available
      const rootNode = parse_hson($hson);
      const branch = createBranchFromNode2(rootNode);
      return {
        asBranch: () => branch,
      };
    },

    /* --- methods for targeting and replacing live dom elements --- */

    queryDom($selector: string): GraftConstructor2 {
      const element = document.querySelector<HTMLElement>($selector);

      /* return the graft constructor object */
      return {
        graft2: (): LiveTree2 => {
          /* the null check here inside the final method call */
          if (!element) {
          throw new Error (`hson.liveTree.queryDom: selector "${$selector}" not found.`);
          }
          // only call the main graft function if the element was found
          return graft2(element, $options);
        }
      };
    },

    queryBody(): GraftConstructor2 {
      const element = document.body;

      /* return the graft constructor object */
      return {
        graft2: (): LiveTree2 => {
          return graft2(element, $options);
        }
      };
    },

  };
}
