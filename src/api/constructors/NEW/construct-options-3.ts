import { RenderFormats } from "../../../core/types-consts/constructors.core.types";
import { construct_render_4_NEW } from "./construct-render-4";
import { OptionsConstructor_3_NEW, FrameOptions, RenderConstructor_4_NEW, FrameRender_NEW } from "./new-types";

/**
 * Stage 3 (NEW): applying output options.
 *
 * These methods configure the final output's formatting.
 *
 * Each call:
 * - merges new flags into `frame.options`,
 * - then returns the final render object (stage 4),
 *   immediately ready for `serialize()` / `parse()` / `asBranch()`.
 *
 * This keeps the original behavior but is typed against the NEW
 * constructor interfaces used by `construct_output_2_NEW`.
 *
 * @param render - the render context from stage 2 (format already chosen).
 * @returns an object exposing the options surface (stage 3).
 */
export function construct_options_3_NEW<K extends RenderFormats>(
  render: FrameRender_NEW<K>
): OptionsConstructor_3_NEW<K> {
  const { frame, output } = render;

  return {
    /**
     * Apply a custom set of formatting options.
     *
     * Convenience helpers like `.noBreak()` and `.spaced()` are shorthands
     * for calling this with specific flags.
     */
    withOptions(opts: FrameOptions):  RenderConstructor_4_NEW<K> {
      const updatedFrame: FrameRender_NEW<K>["frame"] = {
        ...frame,
        options: { ...frame.options, ...opts },
      };
      return construct_render_4_NEW({ frame: updatedFrame, output });
    },

    /**
     * Format the output on a single line with no line breaks.
     */
    noBreak():  RenderConstructor_4_NEW<K> {
      const updatedFrame: FrameRender_NEW<K>["frame"] = {
        ...frame,
        options: { ...frame.options, noBreak: true },
      };
      return construct_render_4_NEW({ frame: updatedFrame, output });
    },

    /**
     * Add human-readable spacing and indentation to the output.
     */
    spaced():  RenderConstructor_4_NEW<K> {
      const updatedFrame: FrameRender_NEW<K>["frame"] = {
        ...frame,
        options: { ...frame.options, spaced: true },
      };
      return construct_render_4_NEW({ frame: updatedFrame, output });
    },

    /**
     * Apply linting / canonicalization rules to the output.
     */
    linted(): RenderConstructor_4_NEW<K> {
      const updatedFrame: FrameRender_NEW<K>["frame"] = {
        ...frame,
        options: { ...frame.options, linted: true },
      };
      return construct_render_4_NEW({ frame: updatedFrame, output });
    },
  };
}