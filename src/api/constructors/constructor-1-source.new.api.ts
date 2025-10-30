import { OutputConstructor_2 } from "../../core/types-consts/constructors.core.types";
import { JsonType } from "../../core/types-consts/core.types";
import { HsonNode } from "../../types-consts";
import { SourceConstructor_1, FrameConstructor } from "../../types-consts/constructors.new.types";
import { make_string } from "../../utils/make-string.nodes.utils";
import { sanitize_html } from "../../utils/sanitize-html.utils";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils";
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
    // Prefer innerHTML for HTMLElement: we want the children, not a wrapper tag
    const raw: string =
      typeof $input === "string" ? $input : $input.innerHTML;

    // Sanitize unless explicitly disabled
    const content: string = $options.sanitize ? sanitize_html(raw) : raw;

    // Parse to HSON node tree (pure step)
    const node: HsonNode = parse_html(content);

    const meta: Record<string, unknown> = $options.sanitize
      ? { sanitized: true }
      : {};

    if (_VERBOSE) {
      console.groupCollapsed("fromHTML frame");
      console.log({ inputPreview: content.slice(0, 200), meta });
      console.groupEnd();
    }

    const frame: FrameConstructor = { input: content, node, meta };
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
    // CHANGED: explicit null check with good error, no silent empty string
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      _throw_transform_err(`queryDOM(): no element for selector "${selector}"`, 'queryDOM', selector);
    }

    const html: string = element.innerHTML;
    return this.fromHTML(html); // fromHTML handles sanitize/unsafe
  },


  /* uses document.body.innerHTML as the source */
  queryBody(): OutputConstructor_2 {
    // defensive check; some environments can have no body briefly
    const body = document.body as HTMLElement | null;
    if (!body) {
      _throw_transform_err('queryBody(): document.body is not available', 'queryBody');
    }
    const html: string = body.innerHTML;
    return this.fromHTML(html); // same rule: sanitize in fromHTML
  },


};
}
