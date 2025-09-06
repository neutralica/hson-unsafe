import { parse_hson } from "../../../api/parsers/parse-hson.transform.hson";
import { parse_html } from "../../../api/parsers/parse-html.transform.hson";
import { parse_json } from "../../../api/parsers/parse-json.transform.hson";
import { OutputConstructor_2 } from "../../../core/types-consts/constructors.core.types.hson";
import { JsonType } from "../../../core/types-consts/core.types.hson";
import { make_string } from "../../../utils/make-string.utils.hson";
import { FrameConstructor_NEW, SourceConstructor_1_NEW } from "../../types-consts/constructors.new.types.hson";
import { HsonNode_NEW } from "../../types-consts/node.new.types.hson";
import { construct_output_2_NEW } from "./constructor-2-output.new.api.hson";


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
export function construct_source_1_NEW(
  options: { unsafe: boolean } = { unsafe: false }
): SourceConstructor_1_NEW {
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
      const frame: FrameConstructor_NEW = { input: content, node, meta };
      if (_VERBOSE) {
        console.groupCollapsed('frame')
        console.log(make_string(frame))
        console.groupEnd();
      }
      return construct_output_2_NEW(frame);
    },

    /**
     * parses a json string or object to hson nodes.
     * @param {string | JsonType} $input the json source data.
     * @returns {OutputConstructor_2} the next stage of the API for selecting output format.
     */
    fromJSON($input: string | JsonType): OutputConstructor_2 {
      const node = parse_json($input as string);
      const frame: FrameConstructor_NEW = {
        input: typeof $input === "string" ? $input : JSON.stringify($input),
        node
      };
      return construct_output_2_NEW(frame);
    },

    /**
     * parses an hson string into hson nodes.
     * @param {string} $input the hson source data.
     * @returns {OutputConstructor_2} the next stage of the API for selecting output format.
     */
    fromHSON($input: string): OutputConstructor_2 {
      const node = parse_hson($input);
      const frame: FrameConstructor_NEW = { input: $input, node };
      return construct_output_2_NEW(frame);
    },

    /**
   * initializes the pipeline from an existing HsonNode.
   * @param {HsonNode_NEW} $node the hson node structure.
   * @returns {OutputConstructor_2} the next stage of the API for selecting output format.
   */
    fromNode($node: HsonNode_NEW): OutputConstructor_2 {
      const frame: FrameConstructor_NEW = { input: JSON.stringify($node), node: $node };
      return construct_output_2_NEW(frame);
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
