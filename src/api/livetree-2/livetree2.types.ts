// livetree2.types.ts

import { JsonValue } from "../../core/types-consts/core.types";
import { HsonNode, HsonQuery, Primitive } from "../../types-consts";
import { $RENDER } from "../../types-consts/constants";
import { OptionsConstructor_3, RenderConstructor_4, LiveTreeConstructor_3, DomQueryLiveTreeConstructor } from "../../types-consts/constructor.types";
import { StyleManager2 } from "./livetree-methods/style-manager2.utils";
import { LiveTree2 } from "./livetree2";
// import existing helpers instead of re-implementing:
// import { getElementForNode } from "../../node-element-map";
// import { ensure_quid } from "../../utils/quid-utils";

export interface NodeRef2 {
  q: string;                        // QUID
  resolveNode(): HsonNode | undefined;
  resolveElement(): Element | undefined;
}

// Callable finder set (like your current FindWithById)
export interface FindWithById2 {
  (q: HsonQuery | string): LiveTree2 | undefined;
  byId(id: string): LiveTree2 | undefined;
  must(q: HsonQuery | string, label?: string): LiveTree2;
  mustById(id: string, label?: string): LiveTree2;
}


// Helper type for the new createAppend on LiveTree2
export interface CreateAppendResult {
  // chainable index insertion:
  at(index: number): LiveTree2;
}

// LiveTree2.createAppend call shape
// export interface LiveTreeCreateAppend {
//   (this: LiveTree2, tag: TagName | TagName[]): CreateAppendResult;
//   (this: LiveTree2, tag: TagName | TagName[], index: number): LiveTree2;
// }
export type LiveTreeCreateAppend =
  (this: LiveTree2,
   tag: keyof HTMLElementTagNameMap | (keyof HTMLElementTagNameMap)[],
   index?: number
  ) => LiveTree2 | CreateAppendResult;
/* main source constructor */

export interface TreeConstructor_Source2 {
  /* for creating new tree content from data */
  fromHTML(htmlString: string): BranchConstructor2;
  fromJSON(json: string | JsonValue): BranchConstructor2;
  fromHSON(hsonString: string): BranchConstructor2;

  /* for targeting the existing DOM (not a LiveTree) and replcaing with graft() */
  queryDom(selector: string): GraftConstructor2;
  queryBody(): GraftConstructor2;
}

export interface GraftConstructor2 {
  /* replaces the target DOM element's content with the HSON-controlled version,
        and returns the interactive LiveTree */
  graft2(): LiveTree2;
}

export interface BranchConstructor2 {
  /* returns the created LiveTree instance as a detached "branch"
         ready to be appended to another tree */
  asBranch(): LiveTree2;
}
export interface LiveTreeConstructor_32 {
    asBranch2(): LiveTree2;
}
// export type FrameMode = (typeof HSON_FrameΔ)[keyof typeof HSON_FrameΔ];
// what hson.queryDOM/queryBody return

export interface DomQuerySourceConstructor {
    liveTree(): DomQueryLiveTreeConstructor;
    liveTree2(): DomQueryLiveTreeConstructor2;
}
// what hson.queryDOM(...).liveTree() returns


export interface DomQueryLiveTreeConstructor2 {
    graft2(): LiveTree2;
}
/**
 * Step 2 – output format selection.
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
    liveTree2(): LiveTreeConstructor_32;

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
// deprecated in favor of expanding output constructor with liveTree2
// export interface OutputConstructor_22 {
//     toJSON(): OptionsConstructor_3<(typeof $RENDER)["JSON"]> &
//         RenderConstructor_4<(typeof $RENDER)["JSON"]>;

//     toHSON(): OptionsConstructor_3<(typeof $RENDER)["HSON"]> &
//         RenderConstructor_4<(typeof $RENDER)["HSON"]>;

//     toHTML(): OptionsConstructor_3<(typeof $RENDER)["HTML"]> &
//         RenderConstructor_4<(typeof $RENDER)["HTML"]>;

//     // LiveTree output constructor
//     liveTree2(): LiveTreeConstructor_32;

//     /**
//      * 🔥 HTML-style sanitization applied *after* source selection.
//      *
//      * This:
//      *   1) takes the current Node (frame.node),
//      *   2) serializes it to HTML,
//      *   3) runs that HTML through the *untrusted* HTML pipeline
//      *      (DOMPurify via `parse_external_html` / 'sanitize_html'),
//      *   4) parses the sanitized HTML back into Nodes,
//      *   5) returns a NEW builder rooted at that sanitized Nodes.
//      *
//      * Use cases:
//      * - unknown/untrusted JSON/HSON/Nodes that semantically encode HTML
//      *   may need to be run through the HTML sanitizer before touching the DOM.
//      *
//      * Dangers:
//      * - If your data is *not* HTML-shaped (e.g. is JSON, or nodes encoding same),
//      *   this will return an empty string; the DOMPuriufy sees underscored tags
//      *   as invalid markup and strips aggressively.
//      *
//      *  *** ONLY call this on HsonNodes that encode HTML ***
//      *
//      */
//     sanitizeBEWARE(): OutputConstructor_22;
// }

