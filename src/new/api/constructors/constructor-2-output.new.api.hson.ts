// to-output.hson.infra.ts

import { ensure_OLD } from "../../../_refactor/_refactor-utils/ensure-old.utils.hson";
import { serialize_hson } from "../../../api/serializers/serialize-hson.render.hson";
import { serialize_html } from "../../../api/serializers/serialize-html.render.hson";
import { serialize_json } from "../../../api/serializers/serialize-json.render.hson";
import { create_proxy } from "../../../old/livetree/create-proxy.tree.hson";
import { OutputConstructor_2 } from "../../../core/types-consts/constructors.core.types.hson";
import { FrameRender } from "../../../old/types/constructors.old.types.hson";
import { RenderΔ } from "../../../types-consts/constants.hson";
import { FrameConstructor_NEW, FrameRender_NEW } from "../../types-consts/constructors.new.types.hson";
import { construct_options_3_NEW } from "./constructor-3-options.new.api.hson";
import { construct_render_4_NEW } from "./constructor-4-render.new.api.hson";
import { create_proxy_NEW } from "../livetree/create-proxy.new.tree.hson";

/**
 *  hson.transform / stage 2 (of 4) - select output format
 *
 * each `to...` method serializes the internal node structure into the chosen format
 * and returns it in an object that allows for optional configuration or immediate rendering.
 * the `asTree` method ends the chain and returns a live, stateful proxy object 
 *   (-> create_live_tree is still required to graft it to the DOM).
 * @param {FrameConstructor_NEW} $frame the context object containing the parsed hson node.
 * @returns {OutputConstructor_2} an object with methods to specify the output format.
 */

export function construct_output_2_NEW($frame: FrameConstructor_NEW): OutputConstructor_2 {
    
    /* wee helper for the final conversion steps */
    function createFinalizer_NEW(context: FrameRender_NEW) {
        return {
            ...construct_options_3_NEW(context),
            ...construct_render_4_NEW(context)
        };
    }

    return {
        /*  transform to another format  */
        toHSON() {
            const hson = serialize_hson($frame.node);
            const context: FrameRender_NEW = { frame: { ...$frame, hson }, output: RenderΔ.HSON };
            return createFinalizer_NEW(context);
        },
        toJSON() {
            const json = serialize_json($frame.node);
            const context: FrameRender_NEW = { frame: { ...$frame, json }, output: RenderΔ.JSON };
            return createFinalizer_NEW(context);
        },
        toHTML() {
            const html = serialize_html($frame.node);
            const context: FrameRender_NEW = { frame: { ...$frame, html }, output: RenderΔ.HTML };
            return createFinalizer_NEW(context);
        },

        /* or: access the data directly as a proxy */
        asTree() {
            // TODO -- LIVE TREE IS CURRENTLY FED OLD SHAPE - CONVERT TO _NEW
            return create_proxy_NEW($frame.node);
        }
    };
}
