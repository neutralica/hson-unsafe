
import { JSONShape, HsonNode } from "../../types-consts/base.types.hson.js";
import { FrameConstructor, OutputConstructor_2, SourceConstructor_1 } from "../../types-consts/constructors.types.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { sanitize_html } from "../../utils/sanitize-html.utils.hson.js";
import { parse_html } from "../parsers/parse-html.transform.hson.js";
import { parse_json } from "../parsers/parse-json.transform.hson.js";
import { parse_tokens } from "../parsers/parse-tokens.transform.hson.js";
import { tokenize_hson } from "../parsers/tokenize-hson.transform.hson.js";
import { construct_output_2 } from "./constructor-2-output.api.hson.js";



/* debug log */
let VERBOSE = false;
const $log = VERBOSE
  ? console.log
  : () => { };


/**
 * hson.transform - step 1 (of 4)
 * extends three methods that accept source data 
 *  - json or html, as string or parsed
 *  - hson as string 
 * constructs the initial hson node from source.
 * this is the entry point for the fluent data transformation API.
 * * @returns {source_constructor_1} an object with methods to specify the input data.
 */
export function construct_source_1(
  options: { unsafe: boolean } = { unsafe: false }
): SourceConstructor_1 {
  return {
    /**
     * accepts an html string or HTMLElement and converts to hson nodes
     * @param {string | Element} $input the html source data.
     * @param {object} [$options={ sanitize: true }] parsing options.
     * @returns {OutputConstructor_2} the next step of the API for selecting output format.
     */
    fromHTML(
      $input: string | HTMLElement,
      $options: { sanitize: boolean } = { sanitize: true }
    ): OutputConstructor_2 {
      let content = typeof $input === 'string' ? $input : $input.outerHTML;
      let meta: Record<string, unknown> = {};
      if (VERBOSE) {
        console.groupCollapsed('html (within constructor 1)')
        console.log($input)
        console.groupEnd();
      }
      if ($options.sanitize) {
        content = sanitize_html(content);
        meta.sanitized = true;
      }

      const node = parse_html(content);
      const frame: FrameConstructor = { input: content, node, meta };
      if (VERBOSE) {
        console.groupCollapsed('frame')
        console.log(make_string(frame))
        console.groupEnd();
      }
      return construct_output_2(frame);
    },

    /**
     * parses a json string or object to hson nodes.
     * @param {string | JSONShape} $input the json source data.
     * @returns {OutputConstructor_2} the next stage of the API for selecting output format.
     */
    fromJSON($input: string | JSONShape): OutputConstructor_2 {
      const node = parse_json($input as string);
      const frame: FrameConstructor = {
        input: typeof $input === "string" ? $input : JSON.stringify($input),
        node
      };
      return construct_output_2(frame);
    },

    /**
     * parses an hson string into hson nodes.
     * @param {string} $input the hson source data.
     * @returns {OutputConstructor_2} the next stage of the API for selecting output format.
     */
    fromHSON($input: string): OutputConstructor_2 {
      const tokens = tokenize_hson($input);
      const node = parse_tokens(tokens);
      const frame: FrameConstructor = { input: $input, tokens, node };
      return construct_output_2(frame);
    },

      /**
     * initializes the pipeline from an existing HsonNode.
     * @param {HsonNode} $node the hson node structure.
     * @returns {OutputConstructor_2} the next stage of the API for selecting output format.
     */
      fromNode($node: HsonNode): OutputConstructor_2 {
        const frame: FrameConstructor = { input: JSON.stringify($node), node: $node };
        return construct_output_2(frame);
    },
      

    queryDOM(selector: string): OutputConstructor_2 {
      const element = document.querySelector(selector);
      const html = element ? element.innerHTML : '';
      // re-uses fromHTML to respect the unsafe flag
      return this.fromHTML(html);
    },

    /* new: uses document.body.innerHTML as the source */
    queryBody(): OutputConstructor_2 {
      const html = document.body.innerHTML;
      // re-uses fromHTML to respect the unsafe flag
      return this.fromHTML(html);
    },


  };
}
