import { construct_source_1 } from "./api/constructors/constructor-1-source.api";
import { construct_tree } from "./api/constructors/constructor-tree.api";
import { construct_source_1_NEW } from "./api/constructors/NEW/construct-source-1";
import { DomQueryLiveTreeConstructor, DomQuerySourceConstructor, OutputConstructor_2_NEW } from "./api/constructors/NEW/new-types";
import { LiveTree } from "./api/livetree";
import { HsonNode } from "./types-consts";
import { JsonValue } from "./types-consts/node.new.types";


(globalThis as any)._test_ON = () => { (globalThis as any).test_new = true; location.reload(); };
(globalThis as any)._test_OFF = () => { (globalThis as any).test_new = false; location.reload(); };

/** import hson 
 * current methods: 
 * - transform() (for simple conversions from format to format)
 * - liveTree() (returns a manipulable JSON tree 'grafted' into the DOM)
 * - unsafe (provides access to non-sanitized versions of the pipelines)
 */
export const hson_OLD = {
  /**
   * the entry point for all stateless data transformations
   * returns a chainable object to convert between formats
   * sanitizes html by default
   */
  get transform() {
    return construct_source_1({ unsafe: false });
  },

  /**
   * the entry point for the stateful dom interaction pipeline
   * returns a chainable object for creating and manipulating live trees
   * sanitizes html by default
   */
  get liveTree() {
    return construct_tree({ unsafe: false });
  },

  /**
   * provides access to unsafe, non-sanitized versions of the pipelines
   * use with trusted, developer-authored content only
   */
  UNSAFE: {
    /**
     * accesses the unsafe stateless data transformation pipeline
     */
    get transform() {
      return construct_source_1({ unsafe: true });
    },
    /**
     * accesses the unsafe stateful dom interaction pipeline
     */
    get liveTree() {
      return construct_tree({ unsafe: true });
    }
  },

  /**
   * stubbed out for future development
   */
  liveMap: {},
};




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

export const hson = {
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
  fromUntrustedHtml(input: string | Element): OutputConstructor_2_NEW {
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
  fromTrustedHtml(input: string | Element): OutputConstructor_2_NEW {
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
  fromJSON(input: string | JsonValue): OutputConstructor_2_NEW {
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
  fromHSON(input: string): OutputConstructor_2_NEW {
    return construct_source_1_NEW({ unsafe: true }).fromHSON(input);
  },

  /**
   * Existing HsonNode → (chained output).
   *
   * Initializes the pipeline from an already-constructed Node.
   * No sanitization is applied here.
   */
  fromNode(node: HsonNode): OutputConstructor_2_NEW {
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
  queryDOM(selector: string): DomQuerySourceConstructor {
    const el = document.querySelector<HTMLElement>(selector);
    return {
      liveTree(): DomQueryLiveTreeConstructor {
        return {
          graft(): LiveTree {
            // reuse your existing construct_tree + graft logic
            return construct_tree({ unsafe: false }).queryDom(selector).graft();
            // or: graft(el, { unsafe: false }) if you have a direct helper
          },
        };
      },
    };
  },

  /**
   * `document.body.innerHTML` → HSON Nodes.
   *
   * Snapshot helper for the entire page.
   *
   - Uses the *trusted* HTML path by default (no DOMPurify).
   * - Throws a structured transform error if `document.body` is unavailable.
   */

  queryBody(): DomQuerySourceConstructor {
    return {
      liveTree(): DomQueryLiveTreeConstructor {
        return {
          graft(): LiveTree {
            return construct_tree({ unsafe: false }).queryBody().graft();
          },
        };
      },
    };
  },

};