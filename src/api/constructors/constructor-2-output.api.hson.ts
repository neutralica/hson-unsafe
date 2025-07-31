// to-output.hson.infra.ts

import { RenderΔ } from "../../types-consts/constants.hson.js";
import { FrameConstructor, OutputConstructor_2, FrameRender } from "../../types-consts/constructors.types.hson.js";
import { serialize_hson } from "../serializers/serialize-hson.render.hson.js";
import { serialize_html } from "../serializers/serialize-html.render.hson.js";
import { serialize_json } from "../serializers/serialize-json.render.hson.js";
import { create_proxy } from "../tree/create-proxy.tree.hson.js";
import { construct_options_3 } from "./constructor-3-options.api.hson.js";
import { construct_render_4 } from "./constructor-4-render.api.hson.js";

/**
 *  hson.transform / stage 2 (of 4) - select output format
 *
 * each `to...` method serializes the internal node structure into the chosen format
 * and returns it in an object that allows for optional configuration or immediate rendering.
 * the `asTree` method ends the chain and returns a live, stateful proxy object 
 *   (-> create_live_tree is still required to graft it to the DOM).
 * @param {FrameConstructor} $frame the context object containing the parsed hson node.
 * @returns {OutputConstructor_2} an object with methods to specify the output format.
 */

export function construct_output_2($frame: FrameConstructor): OutputConstructor_2 {
    
    /* wee helper for the final conversion steps */
    function createFinalizer(context: FrameRender) {
        return {
            ...construct_options_3(context),
            ...construct_render_4(context)
        };
    }

    return {
        /*  transform to another format  */
        toHSON() {
            const hson = serialize_hson($frame.node);
            const context: FrameRender = { frame: { ...$frame, hson }, output: RenderΔ.HSON };
            return createFinalizer(context);
        },
        toJSON() {
            const json = serialize_json($frame.node);
            const context: FrameRender = { frame: { ...$frame, json }, output: RenderΔ.JSON };
            return createFinalizer(context);
        },
        toHTML() {
            const html = serialize_html($frame.node);
            const context: FrameRender = { frame: { ...$frame, html }, output: RenderΔ.HTML };
            return createFinalizer(context);
        },

        /* or: access the data directly as a proxy */
        asTree() {
            return create_proxy($frame.node);
        }
    };
}
