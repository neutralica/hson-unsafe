
import { $HSON_FRAME, $RENDER, } from "./constants";
import { HsonNode } from "./node.types";
import { JsonValue } from "../core/types-consts/core.types";
import { LiveTree } from "../api/livetree";

export interface FrameRender<K extends RenderFormats> {
  frame: FrameConstructor;
  output: K;
}

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

export interface SourceConstructor_1 {
    /** HSON string → Node */
    fromHSON(input: string): OutputConstructor_2;

    /** JSON → Nodes */
    fromJSON(input: string | JsonValue): OutputConstructor_2;

    /** HTML → Nodes
     *
     * - `input` may be an HTML string or an Element (its `innerHTML` is used).
     * - `options.sanitize` controls *per-call* behavior in the safe pipeline:
     *     - safe pipeline (`unsafe: false`):
     *         - `sanitize !== false` → DOMPurify (`parse_external_html`)
     *         - `sanitize === false` → raw HTML parse (`parse_html`)
     *     - unsafe pipeline (`unsafe: true`):
     *         - always raw HTML parse (`parse_html`), flag is ignored.
     */
    fromHTML(input: string | Element, options?: HtmlSourceOptions): OutputConstructor_2;

    /** Nodes → Nodes (identity entrypoint) */
    fromNode(input: HsonNode): OutputConstructor_2;

    /** `document.querySelector(selector).innerHTML` → Nodes
     *
     * - Uses `innerHTML` of the matched element as the HTML source.
     * - In *practice* we only ever call this through a pipeline that has
     *   chosen safe vs unsafe at construction time.
     * - For your facade:
     *     - `hson.queryDOM` uses `{ unsafe: true }` → no sanitization.
     *     - if someone wants a sanitized snapshot, they should use
     *       `hson.fromUntrustedHtml(element)` instead.
     */
    queryDOM(selector: string): OutputConstructor_2;

    /** `document.body.innerHTML` → Nodes
     *
     * Same semantics as `queryDOM`, but for the whole document body.
     */
    queryBody(): OutputConstructor_2;
}


/**
 * NEW: Step 2 – output format selection.
 *
 * This is the object you get back after choosing a *source* via
 * `construct_source(...).fromX(...)`.
 *
 * Each `to...` method:
 * - chooses an output *format* (HTML / JSON / HSON),
 * - materializes that representation into the frame,
 * - and returns an object that is both:
 *   - an optional configuration surface (step 3),
 *   - and the final action surface (step 4).
 *
 * In other words:
 *   hson.fromJSON(data)
 *       .toHTML()        // step 2 – format
 *       .spaced()        // step 3 – options (optional)
 *       .serialize();    // step 4 – final action
 */
export interface OutputConstructor_2 {
    toJSON(): OptionsConstructor_3<(typeof $RENDER)["JSON"]> &
        RenderConstructor_4<(typeof $RENDER)["JSON"]>;

    toHSON(): OptionsConstructor_3<(typeof $RENDER)["HSON"]> &
        RenderConstructor_4<(typeof $RENDER)["HSON"]>;

    toHTML(): OptionsConstructor_3<(typeof $RENDER)["HTML"]> &
        RenderConstructor_4<(typeof $RENDER)["HTML"]>;

    // LiveTree output constructor
    liveTree(): LiveTreeConstructor_3;

    /**
     * 🔥 HTML-style sanitization applied *after* source selection.
     *
     * This:
     *   1) takes the current Node (frame.node),
     *   2) serializes it to HTML,
     *   3) runs that HTML through the *untrusted* HTML pipeline
     *      (DOMPurify via `parse_external_html` / 'sanitize_html'),
     *   4) parses the sanitized HTML back into Nodes,
     *   5) returns a NEW builder rooted at that sanitized Nodes.
     *
     * Use cases:
     * - unknown/untrusted JSON/HSON/Nodes that semantically encode HTML 
     *   may need to be run through the HTML sanitizer before touching the DOM.
     *
     * Dangers:
     * - If your data is *not* HTML-shaped (e.g. is JSON, or nodes encoding same),
     *   this will return an empty string; the DOMPuriufy sees underscored tags 
     *   as invalid markup and strips aggressively.
     *
     *  *** ONLY call this on HsonNodes that encode HTML ***
     * 
     */
    sanitizeBEWARE(): OutputConstructor_2;
}


export interface LiveTreeConstructor_3 {
    asBranch(): LiveTree;
}

/**
 * NEW: Step 3 – optional configuration.
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
 * NEW: Step 4 – final actions.
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
    // asBranch(): LiveTree;
}

// export type FrameMode = (typeof HSON_FrameΔ)[keyof typeof HSON_FrameΔ];

// what hson.queryDOM/queryBody return
export interface DomQuerySourceConstructor {
    liveTree(): DomQueryLiveTreeConstructor;
}

// what hson.queryDOM(...).liveTree() returns
export interface DomQueryLiveTreeConstructor {
    graft(): LiveTree;
}


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

