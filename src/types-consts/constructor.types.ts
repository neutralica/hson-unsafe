
import { $HSON_FRAME, $RENDER, } from "./constants";
import { HsonNode } from "./node.types";
import { JsonValue } from "../core/types-consts/core.types";

export interface HtmlSourceOptions {
    /** Override per-call HTML sanitization.
     *
     * - `true` (default in safe pipeline): sanitize via DOMPurify.
     * - `false`: treat HTML as trusted/internal, even in safe pipeline.
     *
     * NOTE:
     * - In the UNSAFE pipeline (`pipelineOptions.unsafe === true`),
     *   this flag is ignored; HTML is never sanitized there.
     */
    sanitize?: boolean;
}

// export interface LiveTreeConstructor_3 {
//     asBranch(): LiveTree;
// }

/**
 *  Step 3 – optional configuration.
 *
 * These methods adjust how the chosen output format is *rendered*.
 * They always return the final action surface (step 4), so callers
 * can either:
 *
 *   hson.fromJSON(data).toHTML().serialize();
 *   // or
 *   hson.fromJSON(data).toHTML().spaced().linted().serialize();
 */
export interface OptionsConstructor_3<K extends RenderFormats> {

    /**
     * Attach a full options object.
     *
     * This is the "escape hatch" for advanced configuration. Convenience
     * helpers like `.noBreak()` and `.spaced()` are just shorthands that
     * call `withOptions` under the hood.
     */
    withOptions(opts: Partial<FrameOptions>): RenderConstructor_4<K>;


    /** Convenience: set the `noBreak` flag (single-line render). */
    noBreak(): RenderConstructor_4<K>;

    /** Convenience: enable "spaced" output (e.g. pretty-print JSON / HSON). */
    spaced(): RenderConstructor_4<K>;

    /** Convenience: enable linted / normalized output, if supported. */
    linted(): RenderConstructor_4<K>;
}

/**
 * Rendering options for the final step.
 *
 * These flags are interpreted by the lower-level serializers. Not every
 * flag is meaningful for every format, but they provide a common vocabulary
 * for "pretty / compact / linted" style choices.
 */
export interface FrameOptions {
    spaced?: boolean;
    lineLength?: number;
    linted?: boolean;
    noBreak?: boolean;
}

/**
 *  Step 4 – final actions.
 *
 * After you’ve:
 *   - chosen a source (`fromX`),
 *   - chosen a format (`toX`),
 *   - optionally set options (`spaced()`, `withOptions(...)`),
 *
 * this interface provides the concrete outputs:
 *
 * - `serialize()` → string representation (HTML / JSON / HSON),
 * - `parse()`     → structured representation (type depends on format),
 * - `asBranch()`  → LiveTree projection for DOM interaction.
 */
export interface RenderConstructor_4<K extends RenderFormats> {

    /**
     * Render the current frame as a string in the chosen format.
     *
     * Examples:
     * - after `.toHTML()` → HTML string,
     * - after `.toJSON()` → JSON string,
     * - after `.toHSON()` → HSON source text.
     */
    serialize(): string;

    /**
     * Parse the current frame into a structured value appropriate to
     * the chosen format.
     *
     * Examples:
     * - after `.toJSON()` → parsed JSON value (object / array / primitive),
     * - after `.toHTML()` → whatever HTML-level representation your
     *   serializer defines (often just the same string, or a lightweight AST),
     * - after `.toHSON()` → parsed HSON structure.
     *
     * Note:
     * - The return type is `unknown` by design. Callers are expected to
     *   narrow or cast based on which `toX()` they used.
     */
    parse(): ParsedResult<K>;

    /**
     * Project the current Nodes into a LiveTree branch.
     *
     * Behavior:
     * - Builds a LiveTree tied to the current HsonNode frame.
     * - Does **not** automatically attach anything to the DOM; mounting /
     *   grafting remains a separate step on LiveTree (`graft`, `append`, etc.).
     *
     * This is the bridge between the stateless transform pipeline and the
     * stateful DOM interaction layer.
     */
    // REMOVED TO ROUTE THROUGH .LIVETREE() PATH
    // asBranch(): LiveTree;
}

// // what hson.queryDOM(...).liveTree() returns
// export interface DomQueryLiveTreeConstructor {
//     graft(): LiveTree;
// }


export type ParsedResult<K extends RenderFormats> =
    K extends (typeof $RENDER)["JSON"]
    ? JsonValue
    : K extends (typeof $RENDER)["HSON"]
    ? HsonNode
    // HTML has no parseable “valueful” representation in this API
    : never;export type FrameMode = (typeof $HSON_FRAME)[keyof typeof $HSON_FRAME];

export interface FrameConstructor {
    input: string | Element;
    node: HsonNode;
    hson?: string;
    html?: string;
    json?: JsonValue | string;
    mode?: FrameMode;
    meta?: Record<string, unknown>;
    options?: FrameOptions;
}
;
/* OptionsConstructor_3 depends on */


export interface FrameOptions {
    spaced?: boolean;
    lineLength?: number;
    linted?: boolean;
    noBreak?: boolean;
}
;

export type RenderFormats = (typeof $RENDER)[keyof typeof $RENDER];

