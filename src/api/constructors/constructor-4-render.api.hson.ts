import { hson } from "../../hson.js";
import { HsonNode, JsonType, BasicValue } from "../../types-consts/types.hson.js";
import { RenderΔ } from "../../types-consts/constants.hson.js";
import { FrameRender, RenderConstructor_4 } from "../../types-consts/constructors.types.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { create_proxy } from "../tree/create-proxy.tree.hson.js";



/**
 * stage 4 (terminal): serializes or returns the final data object.
 * this is the final stage of the fluent API chain.
 *
 * @param {FrameRender} $context - the fully configured render context.
 * @returns {RenderConstructor_4} an object with terminal methods to get the final result.
 */

export function construct_render_4($context: FrameRender): RenderConstructor_4 {
    const { frame, output } = $context;

    return {
        /**
         * returns the final output as a string formatted according to Options_3
         */
        serialize(): string {
            switch (output) {
                case RenderΔ.HSON:
                    if (!frame.hson) throw new Error('frame is missing HSON data');
                    return frame.hson;

                case RenderΔ.JSON:
                    if (!frame.json) throw new Error('frame is missing JSON data');
                    return typeof frame.json === 'string' ? frame.json : make_string(frame.json);

                case RenderΔ.HTML:
                    if (!frame.html) throw new Error('frame is missing HTML data');
                    return typeof frame.html === 'string' ? frame.html : make_string(frame.html);

                default:
                    throw new Error('invalid serialize format');
            }
        },

        /**
         * returns the "valueful" json data or hson node data (mainly for inspection.debugging) 
         * useful for direct data manipulation in js without the need for an extra parsing step.
         * @returns {JsonType | HsonNode | BasicValue} a js object, array, or primitive, or the hson node tree.
        */
        parse(): JsonType | HsonNode | BasicValue {
            switch (output) {
                case RenderΔ.JSON:
                    if (frame.json)
                        return typeof frame.json === 'string'
                            ? JSON.parse(frame.json)
                            : frame.json;

                case RenderΔ.HSON:
                    /* returns the internal node structure raw for debugging purposes etc. */
                    if (!frame.node) throw new Error('frame is missing hson data to parse');
                    return frame.node;

                case RenderΔ.HTML:
                    /* explicitly throw an error for the HTML path. */
                    throw new Error('.parse() is not available for the HTML output format\n  (use .serialize() to get the HTML string)');

                default:
                    throw new Error('could not find a format to parse');
            }
        },

        /**
         * returns the structure as a "liveTree" proxy permitting 
         *  intuitive dot-notation access & hiding VSN clutter
         */
        // TODO--this is not correct I don't think; should invoke the newer tree methods
        asBranch(): any {
            // return hson.transform.fromHSON
            return create_proxy(frame.node);
        }
    };
}