import { RenderFormats } from "../../../core/types-consts/constructors.core.types";
import { HsonNode } from "../../../types-consts";
import { RenderΔ } from "../../../types-consts/constants";
import { JsonType } from "../../../types-consts/node.new.types";
import { make_string } from "../../../utils/primitive-utils/make-string.nodes.utils";
import { FrameRender_NEW, ParsedResult, RenderConstructor_4_NEW } from "./new-types";

/**
 * Stage 4 (NEW, terminal): serialize or project the final data.
 *
 * This is the final stage of the fluent API chain.
 *
 * The `FrameRender` context coming in here already knows:
 * - which format was chosen in stage 2 (`output: RenderΔ`),
 * - which representation(s) were materialized on the frame
 *   (`frame.html` / `frame.json` / `frame.hson`),
 * - any formatting options that were set in stage 3 (`frame.options`).
 *
 * This constructor exposes three terminal operations:
 *
 * - `serialize()` → string in the chosen format,
 * - `parse()`     → structured value (JSON / Nodes),
 * - `asBranch()`  → LiveTree projection for DOM interaction.
 */
export function construct_render_4_NEW<K extends RenderFormats>(
  context: FrameRender_NEW<K>
): RenderConstructor_4_NEW<K> {
  const { frame, output } = context;

  return {
    /**
     * Return the final output as a string in the chosen format,
     * formatted according to any options supplied in stage 3.
     *
     * - After `.toHSON()` → HSON source text.
     * - After `.toJSON()` → JSON string.
     * - After `.toHTML()` → HTML string.
     */
    serialize(): string {
      switch (output) {
        case RenderΔ.HSON: {
          if (!frame.hson) {
            throw new Error("serialize(): frame is missing HSON data");
          }
          return frame.hson;
        }

        case RenderΔ.JSON: {
          if (frame.json == null) {
            throw new Error("serialize(): frame is missing JSON data");
          }
          return typeof frame.json === "string"
            ? frame.json
            : make_string(frame.json);
        }

        case RenderΔ.HTML: {
          if (frame.html == null) {
            throw new Error("serialize(): frame is missing HTML data");
          }
          return typeof frame.html === "string"
            ? frame.html
            : make_string(frame.html);
        }

        default:
          throw new Error("serialize(): invalid output format");
      }
    },

    /**
     * Return the "valueful" data representation for inspection / manipulation.
     *
     * - After `.toJSON()`:
     *     → parsed JSON value (object / array / primitive).
     * - After `.toHSON()`:
     *     → the internal HsonNode tree (Nodes).
     * - After `.toHTML()`:
     *     → not supported; HTML is inherently stringy, so `.parse()` throws.
     *
     * This is intentionally typed as `unknown`; callers should narrow
     * based on which `toX()` they used:
     *
     *   const val = hson.fromJSON(data).toJSON().parse(); // val: unknown
     *   if (Array.isArray(val)) { ... }
     */
    parse(): ParsedResult<K>  {
      switch (output) {
        case RenderΔ.JSON: {
          if (frame.json == null) {
            throw new Error("parse(): frame is missing JSON data");
          }

          if (typeof frame.json === "string") {
            // JSON string → parse
            return JSON.parse(frame.json) as ParsedResult<K> ;
          }

          // Already a structured JSON value.
          return frame.json as ParsedResult<K> ;
        }

        case RenderΔ.HSON: {
          if (!frame.node) {
            throw new Error("parse(): frame is missing HSON node data");
          }
          // The Node itself is the “parsed” representation.
          return frame.node as ParsedResult<K> ;
        }

        case RenderΔ.HTML: {
          // Explicitly refuse a "parsed" HTML value.
          throw new Error(
            ".parse() is not available for the HTML output format.\n" +
              "Use .serialize() to get the HTML string."
          );
        }

        default:
          throw new Error("parse(): could not find a format to parse");
      }
    },

    /**
     * Project the current Nodes into a LiveTree branch.
     *
     * Behavior:
     * - Uses the current `frame.node` as the root Node.
     * - Builds the LiveTree structure, populating the NODE_ELEMENT_MAP
     *   via `create_live_tree` without immediately grafting to the DOM.
     *
     * This is the bridge from:
     *   "stateless transform pipeline" → "stateful DOM interaction".
     */
    // asBranch(): LiveTree {
    //   if (!frame.node) {
    //     throw new Error("asBranch(): frame is missing HSON node data");
    //   }

    //   const rootNode: HsonNode = frame.node;

    //   // Populate DOM / NODE_ELEMENT_MAP for this subtree without attaching.
    //   // (If create_live_tree returns a DOM Node, we can ignore it here and
    //   // let LiveTree handle actual grafting / append later.)
    //   create_live_tree(rootNode);

    //   return new LiveTree(rootNode);
    // },
  };
}