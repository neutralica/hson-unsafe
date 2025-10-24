import { OutputConstructor_2 } from "../../core/types-consts/constructors.core.types";
import { JsonType } from "../../core/types-consts/core.types";
import { HsonNode } from "../../types-consts";
import { SourceConstructor_1, FrameConstructor } from "../../types-consts/constructors.new.types";
import { make_string } from "../../utils/make-string.nodes.utils";
import { parse_hson } from "../parsers/parse-hson.new.transform";
import { parse_html } from "../parsers/parse-html.new.transform";
import { parse_json } from "../parsers/parse-json.new.transform";
import { construct_output_2 } from "./constructor-2-output.new.api";

/* debug log */
let _VERBOSE = false;
const $log = _VERBOSE
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
      if (_VERBOSE) {
        console.groupCollapsed('html (within constructor 1)')
        console.log($input)
        console.groupEnd();
      }
      // if ($options.sanitize) {
      //   content = sanitize_html(content);
      //   console.log('content from sanitizer: ', content);
      //   meta.sanitized = true;
      // }

      const node = parse_html(content);
      const frame: FrameConstructor = { input: content, node, meta };
      if (_VERBOSE) {
        console.groupCollapsed('frame')
        console.log(make_string(frame))
        console.groupEnd();
      }
      return construct_output_2(frame);
    },

    /**
     * parses a json string or object to hson nodes.
     * @param {string | JsonType} $input the json source data.
     * @returns {OutputConstructor_2} the next stage of the API for selecting output format.
     */
    fromJSON($input: string | JsonType): OutputConstructor_2 {
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
      const node = parse_hson($input);
      const frame: FrameConstructor = { input: $input, node };
      return construct_output_2(frame);
    },

    /**
   * initializes the pipeline from an existing HsonNode.
   * @param {HsonNode_NEW} $node the hson node structure.
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
