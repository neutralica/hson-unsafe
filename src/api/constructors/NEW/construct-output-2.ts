import { HsonNode } from "../../../types-consts";
import { RenderΔ } from "../../../types-consts/constants";
import { FrameConstructor, FrameRender } from "../../../types-consts/constructors.new.types";
import { LiveTree } from "../../livetree";
import { create_live_tree } from "../../livetree/create-live-tree.tree";
import { parse_external_html } from "../../parsers/parse-external-html.transform";
import { serialize_hson } from "../../serializers/serialize-hson.new.render";
import { serialize_html } from "../../serializers/serialize-html.new.render";
import { serialize_json } from "../../serializers/serialize-json.new.render";
import { construct_options_3 } from "../constructor-3-options.api";
import { construct_render_4 } from "../constructor-4-render.api";
import { construct_options_3_NEW } from "./construct-options-3";
import { construct_render_4_NEW } from "./construct-render-4";
import { OutputConstructor_2_NEW, OptionsConstructor_3_NEW, RenderConstructor_4_NEW, LiveTreeConstructor_3_NEW } from "./new-types";

/**
 * HSON pipeline – stage 2 (NEW): select output format.
 *
 * This takes a normalized HSON "frame" (Node + meta) produced by
 * `construct_source_NEW` and produces the format-selection surface:
 *
 *   hson.fromJSON(data)
 *       .toHTML()        // ← this function
 *       .spaced()        // optional options (stage 3)
 *       .serialize();    // final action (stage 4)
 *
 * Each `toX()` call:
 * - serializes the current Node into the chosen format,
 * - stores that representation on the frame (`frame.html` / `frame.json` / `frame.hson`),
 * - and returns a merged object that supports both:
 *   - configuration (OptionsConstructor_3_NEW),
 *   - final actions (RenderConstructor_4_NEW).
 * Given a normalized frame (Node + meta), this exposes:
 * - text outputs:  .toHTML() / .toJSON() / .toHSON()
 * - LiveTree:      .liveTree().asBranch()
 * - cross-format transform: .sanitizeBEWARE() (Node → HTML → DOMPurify → Node)
 */
export function construct_output_2_NEW(frame: FrameConstructor): OutputConstructor_2_NEW {

  function makeFinalizer(context: FrameRender): OptionsConstructor_3_NEW & RenderConstructor_4_NEW {
    return {
      ...construct_options_3_NEW(context),
      ...construct_render_4_NEW(context),
    };
  }

  function makeBuilder(currentFrame: FrameConstructor): OutputConstructor_2_NEW {
    return {
      toHSON(): OptionsConstructor_3_NEW & RenderConstructor_4_NEW {
        const hson = serialize_hson(currentFrame.node);
        const ctx: FrameRender = {
          frame: { ...currentFrame, hson },
          output: RenderΔ.HSON,
        };
        return makeFinalizer(ctx);
      },

      toJSON(): OptionsConstructor_3_NEW & RenderConstructor_4_NEW {
        const json = serialize_json(currentFrame.node);
        const ctx: FrameRender = {
          frame: { ...currentFrame, json },
          output: RenderΔ.JSON,
        };
        return makeFinalizer(ctx);
      },

      toHTML(): OptionsConstructor_3_NEW & RenderConstructor_4_NEW {
        const html = serialize_html(currentFrame.node);
        const ctx: FrameRender = {
          frame: { ...currentFrame, html },
          output: RenderΔ.HTML,
        };
        return makeFinalizer(ctx);
      },

      liveTree(): LiveTreeConstructor_3_NEW {
        return {
          asBranch(): LiveTree {
            const node: HsonNode | undefined = currentFrame.node;
            if (!node) {
              throw new Error("liveTree().asBranch(): frame is missing HSON node data");
            }
            // Populate NODE_ELEMENT_MAP; actual attach happens later via graft/append.
            create_live_tree(node);
            return new LiveTree(node);
          },
        };
      },

      sanitizeBEWARE(): OutputConstructor_2_NEW {
        const node: HsonNode | undefined = currentFrame.node;
        if (!node) {
          throw new Error("sanitizeBEWARE(): frame is missing HSON node data");
        }

        // 1) Node → HTML string
        const rawHtml: string = serialize_html(node);

        // 2) Untrusted HTML path: DOMPurify + parse_external_html
        const sanitizedNode: HsonNode = parse_external_html(rawHtml);

        // 3) Build a new frame rooted at the sanitized Node
        const nextFrame: FrameConstructor = {
          input: rawHtml,
          node: sanitizedNode,
          meta: {
            ...currentFrame.meta,
            origin: "html-sanitized-from-node",
            sanitized: true,
            unsafePipeline: false,
          },
        };

        // 4) Return a fresh builder for the sanitized frame
        return makeBuilder(nextFrame);
      },
    };
  }

  return makeBuilder(frame);
}