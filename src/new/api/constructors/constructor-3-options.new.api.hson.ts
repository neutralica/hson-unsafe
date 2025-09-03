import { OptionsConstructor_3, RenderConstructor_4 } from "../../../core/types-consts/constructors.core.types.hson";
import { FrameRender_NEW } from "../../types-consts/constructors.new.types.hson";
import { FrameOptions } from "../../../core/types-consts/constructors.core.types.hson";
import { construct_render_4_NEW } from "./constructor-4-render.new.api.hson";

/**
 * stage 3 (optional): applying output options.
 *
 * these methods configure the final output's formatting.
 * each updates the 'options' on the frame and returns the
 * final render object, immediately ready for serialization.
 *
 * @param {FrameRender_NEW} $render - Tthe render context from stage 2.
 * @returns {OptionsConstructor_3} an object with 3 layers of chained transforms
 */
export function construct_options_3_NEW ($render: FrameRender_NEW): OptionsConstructor_3 {
    const {frame, output} = $render;
    return {
      /**
       * applies a custom set of formatting options.
       * @param {FrameOptions} $opts - The options object to apply.
       * @returns the final stage of the API.
       */
      withOptions($opts: FrameOptions):RenderConstructor_4 {
          const updatedFrame = {
              ...frame,
              options: { ...frame.options, ...$opts }
          };
          return construct_render_4_NEW({frame: updatedFrame, output});
      },
      /**
       * formats the output on a single line with no breaks.
       * @returns the final stage of the API.
       */
      noBreak():RenderConstructor_4 {
          const updatedFrame = { ...frame, options: { ...frame.options, noBreak: true } };
          return construct_render_4_NEW({frame: updatedFrame, output})
      },
      /**
       * adds human-readable spacing and indentation to the output.
       * @returns {the final stage of the API.
       */
      spaced():RenderConstructor_4 {
          const updatedFrame = { ...frame, options: { ...frame.options, spaced: true } };
          return construct_render_4_NEW({ frame: updatedFrame, output });
      },
      /**
       * applies linting rules to the output for canonical formatting.
       * @returns rhe final stage of the API.
       */
      linted(): RenderConstructor_4 {
        const updatedFrame = { ...frame, options: { ...frame.options, linted: true } };
        return construct_render_4_NEW({ frame: updatedFrame, output });
    },
  };
}

