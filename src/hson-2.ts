
import { construct_tree } from "./api/constructors/constructor-tree.api";
import { construct_source_1_NEW } from "./api/constructors/NEW/construct-source-1";
import { OutputConstructor_2 } from "./core/types-consts/constructors.core.types";
import { HsonNode } from "./types-consts";
import { JsonType } from "./types-consts/node.new.types";

/**
 * HSON public facade (NEW).
 *
 * This is the primary entry point for all HSON operations.
 *
 * Design:
 * - Step 1: choose a **source** via:
 *     - `hson.fromUntrustedHtml(html)`
 *     - `hson.fromTrustedHtml(html)`
 *     - `hson.fromJSON(json)`
 *     - `hson.fromHSON(text)`
 *     - `hson.fromNode(node)`
 *     - `hson.queryDOM(selector)`
 *     - `hson.queryBody()`
 *
 * - Step 2: chain into the existing output pipeline returned by step 1:
 *   e.g. `.toHtml()`, `.toJson()`, `.toHson()`, `.branch()` (LiveTree), etc.
 *
 * Trust model overview:
 *
 * - `fromUntrustedHtml(html)`:
 *   - For external / untrusted / user-supplied HTML.
 *   - Always runs the HTML through DOMPurify via `parse_external_html`.
 *   - Produces Nodes that has been sanitized according to your HTML policy.
 *
 * - `fromTrustedHtml(html)`:
 *   - For internal / developer-authored HTML only.
 *   - Bypasses DOMPurify; HTML is parsed raw via `parse_html`.
 *   - The resulting Nodes can express SVG, script tags, and other features that
 *     are blocked in the safe pipeline.
 *
 * - `fromJSON`, `fromHSON`, `fromNode`:
 *   - Treat inputs as *structural data / Nodes*, not markup.
 *   - No DOMPurify is applied here.
 *   - If these structures encode HTML AST and you need HTML-style sanitization,
 *     that should be done explicitly later (e.g. Nodes → HTML → DOMPurify → Nodes).
 *
 * The older `hson.transform` / `hson.liveTree` getters are preserved for
 * backwards compatibility but are deprecated in favor of these flattened
 * entrypoints.
 */
export const hson2 = {

  /**
   * External / untrusted HTML → sanitized HSON Nodes → (chained output).
   *
   * Use this when the HTML comes from:
   * - user input,
   * - a CMS,
   * - remote content,
   * - or any source you do not fully control.
   *
   * Behavior:
   * - Runs HTML through DOMPurify via `parse_external_html`.
   * - Produces a frame that records `{ origin: "html", sanitized: true }`.
   * - Does **not** attach anything to the DOM; further calls decide whether to:
   *     - serialize (`.toHtml()`, `.toJson()`, `.toHson()`),
   *     - or project into a LiveTree (`.branch()`).
   */
  fromUntrustedHtml(input: string | Element): OutputConstructor_2 {
    return construct_source_1_NEW({ unsafe: false }).fromHTML(input, {
      sanitize: true,
    });
  },

  /**
   * Internal / trusted HTML → raw HSON Nodes → (chained output).
   *
   * Use this only when the HTML comes from:
   * - your own source files,
   * - templates under your control,
   * - fixtures / demos / test content you own.
   *
   * Behavior:
   * - Bypasses DOMPurify; parses HTML via `parse_html` with no sanitization.
   * - The resulting Nodes can include SVG, script tags, and attributes which the
   *   safe pipeline would strip or reject.
   * - Meta is marked as `{ origin: "html", unsafePipeline: true, sanitized: false }`.
   *
   * Never feed untrusted / user-supplied HTML through this method.
   */
  fromTrustedHtml(input: string | Element): OutputConstructor_2 {
    return construct_source_1_NEW({ unsafe: true }).fromHTML(input, {
      sanitize: false,
    });
  },

  // ────────────────────────────────────────────────────────────
  // Structural formats: JSON / HSON text / Nodes
  // ────────────────────────────────────────────────────────────

  /**
   * JSON → HSON Nodes → (chained output).
   *
   * Treats the input as *structured data*, not markup.
   *
   * Behavior:
   * - Parses JSON via `parse_json` to HsonNode.
   * - No DOMPurify is applied.
   * - If your JSON encodes an HTML AST and you want HTML-style sanitization,
   *   you must handle that explicitly (e.g. Nodes → HTML → DOMPurify → Nodes).
   */
  fromJSON(input: string | JsonType): OutputConstructor_2 {
    // You can choose `{ unsafe: true }` or `{ unsafe: false }` here; for JSON,
    // the "unsafe" flag only tags meta and affects follow-up HTML parsing
    // decisions, not this step itself. Using `unsafe: true` makes it explicit
    // that this pipeline is free to express everything internally.
    return construct_source_1_NEW({ unsafe: true }).fromJSON(input);
  },

  /**
   * HSON text → HSON Nodes → (chained output).
   *
   * Parses HSON source text into Nodes. No DOMPurify is used here.
   */
  fromHSON(input: string): OutputConstructor_2 {
    return construct_source_1_NEW({ unsafe: true }).fromHSON(input);
  },

  /**
   * Existing HsonNode → (chained output).
   *
   * Initializes the pipeline from an already-constructed Node.
   * No sanitization is applied here.
   */
  fromNode(node: HsonNode): OutputConstructor_2 {
    return construct_source_1_NEW({ unsafe: true }).fromNode(node);
  },

  // ────────────────────────────────────────────────────────────
  // DOM snapshot helpers (HTML taken from the live document)
  // ────────────────────────────────────────────────────────────

  /**
   * `document.querySelector(selector).innerHTML` → HSON Nodes.
   *
   * Snapshot helper for existing DOM.
   *
   * Behavior:
   * - Reads `innerHTML` of the matched element.
   * - Uses the *trusted* HTML path by default (no DOMPurify), since the
   *   current document is typically authored by you.
   * - Throws a structured transform error if the selector matches nothing.
   */
  queryDOM(selector: string): OutputConstructor_2 {
    return construct_source_1_NEW({ unsafe: true }).queryDOM(selector);
  },

  /**
   * `document.body.innerHTML` → HSON Nodes.
   *
   * Snapshot helper for the entire page.
   *
   - Uses the *trusted* HTML path by default (no DOMPurify).
   * - Throws a structured transform error if `document.body` is unavailable.
   */
  queryBody(): OutputConstructor_2 {
    return construct_source_1_NEW({ unsafe: true }).queryBody();
  },

  // ────────────────────────────────────────────────────────────
  // DEPRECATED: legacy constructor namespaces
  // ────────────────────────────────────────────────────────────

  /**
   * @deprecated
   * Legacy transform entrypoint.
   *
   * Prefer the flattened API:
   *   - `hson.fromUntrustedHtml(...)`
   *   - `hson.fromTrustedHtml(...)`
   *   - `hson.fromJSON(...)`
   *   - `hson.fromHSON(...)`
   *   - `hson.fromNode(...)`
   *
   * This getter remains only for backward compatibility and will be removed
   * once all call-sites are migrated.
   */
  get transform() {
    return construct_source_1_NEW({ unsafe: false });
  },

  /**
   * @deprecated
   * Legacy LiveTree entrypoint.
   *
   * Prefer using the unified pipeline to produce Nodes first and then branch:
   *   - `hson.fromUntrustedHtml(...).branch()`
   *   - `hson.fromTrustedHtml(...).branch()`
   *   - `hson.fromJSON(...).branch()`
   *
   * For now, this method remains as a compatibility layer while the unified
   * entrypoints are being adopted.
   */
  get liveTree() {
    return construct_tree({ unsafe: false });
  },

  /**
   * @deprecated
   * Legacy UNSAFE constructor namespace.
   *
   * Existing code that uses `hson.UNSAFE.transform` or `hson.UNSAFE.liveTree`
   * will continue to work, but new code should prefer:
   *   - `hson.fromTrustedHtml(...)`
   *   - `hson.fromJSON(...)`
   *   - `hson.fromHSON(...)`
   *   - `hson.fromNode(...)`
   */
  UNSAFE: {
    get transform() {
      return construct_source_1_NEW({ unsafe: true });
    },
    get liveTree() {
      return construct_tree({ unsafe: true });
    },
  },
};