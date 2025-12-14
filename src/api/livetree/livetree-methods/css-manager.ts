// css-manager.ts

import { PropertyManager } from "../../../types-consts/at-property.types";
import { $HSON_FRAME, _DATA_QUID, $_FALSE, _TRANSIT_ATTRS, _TRANSIT_PREFIX } from "../../../types-consts/constants";
import { CssValue, CssProp, CssHandle } from "../../../types-consts/css.types";
import { apply_animation, CssScope, normalizeName } from "./animate";
import { AnimAdapters, AnimApi, AnimationEndMode, AnimationName, AnimationSpec } from "./animate.types";
import { manage_property } from "./at-property";
import { KeyframesManager, manage_keyframes } from "./keyframes";
import { make_style_setter, StyleSetter } from "./style-setter";


export function css_for_quids(quids: readonly string[]): CssHandle {
  const mgr = CssManager.invoke();
  const ids = quids.map(q => q.trim()).filter(Boolean);

  const atProperty = mgr.atProperty ?? mgr.atPropManager;         // depending on your final naming
  const keyframes = mgr.keyframes ?? mgr.keyframeManager;

  const anim = mgr.anim_for_quids(ids);

  const setter = make_style_setter({
    apply: (propCanon, value) => {
      for (const quid of ids) mgr.setForQuid(quid, propCanon, String(value));
    },
    remove: (propCanon) => {
      for (const quid of ids) mgr.unsetForQuid(quid, propCanon);
    },
    clear: () => {
      for (const quid of ids) mgr.clearQuid(quid);
    },
  });

  return { ...setter, atProperty, keyframes, anim };
}
/**
 * Convenience wrapper for the single-QUID case.
 *
 * Equivalent to:
 *   `css_for_quids([quid])`
 */
export function css_for_quid(quid: string): CssHandle {   // NEW
  return css_for_quids([quid]);
}

function renderCssValue(v: CssValue): string {
  // string → already a valid CSS literal
  if (typeof v === "string") {
    return v;
  }

  // object → { value, unit } → e.g. "12px", "1.5rem"
  return `${v.value}${v.unit}`;
}

function selectorForQuid(quid: string): string {
  // SINGLE place where we define how a QUID maps to a CSS selector
  return `[${_DATA_QUID}="${quid}"]`;
}
function canon_to_css_prop(propCanon: string): string {
  // CSS custom properties keep their spelling
  if (propCanon.startsWith("--")) return propCanon;

  // Already kebab (your StyleKey allowed `${string}-${string}`)
  if (propCanon.includes("-")) return propCanon;

  // camelCase -> kebab-case
  return propCanon.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}
/**
 * Singleton manager for QUID-scoped CSS rules.
 *
 * Responsibility:
 * - Maintains an in-memory map: `QUID → (property → value)`.
 * - Renders that map into a single `<style>` element in the document,
 *   using the QUID→selector mapping from `selectorForQuid`.
 * - Provides both write APIs (`setForQuid`, `setManyForQuid`, `unsetForQuid`,
 *   `clearQuid`, `clearAll`) and read/introspection APIs
 *   (`hasQuid`, `hasPropForQuid`, `getPropForQuid`, `getQuidCss`,
 *   `getCombinedCss`).
 *
 * DOM contract:
 * - On first use, creates a host `<hson_style id="css-manager">` in `document.body`
 *   and a `<style id="_hson">` inside it.
 * - Every mutation calls `syncToDom()`, which rebuilds the full stylesheet
 *   text from the current rules and assigns it to that `<style>` element.
 *
 * Error handling:
 * - Throws if called with empty QUIDs or blank property names in the write
 *   APIs, to catch programmer errors early.
 */
export class CssManager {
  private static instance: CssManager | null = null;
  // QUID → (property → rendered value)
  private readonly rulesByQuid: Map<string, Map<string, string>> = new Map();
  private styleEl: HTMLStyleElement | null = null;
  public readonly atPropManager: PropertyManager;
  public readonly keyframeManager: KeyframesManager;
  private dirty = false;
  private scheduled = false;

  private constructor() {
    this.atPropManager = manage_property({ onChange: () => this.mark_changed() });
    this.keyframeManager = manage_keyframes({ onChange: () => this.mark_changed() });
  }


  private mark_changed(): void {
    this.dirty = true;
    if (this.scheduled) return;

    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (!this.dirty) return;
      this.dirty = false;
      this.syncToDom();
    });
  }

  public static invoke(): CssManager { /* (= getInstance) */
    if (!CssManager.instance) {
      CssManager.instance = new CssManager();
    }
    return CssManager.instance;
  }
  /**
     * Ensure the backing `<style>` element exists in the document and return it.
     *
     * Structure:
     *   <hson-_style id="css-manager">
     *     <style id="_hson">…compiled QUID rules…</style>
     *   </hson-_style>
     *
     * This is internal to `CssManager`; callers should not mutate the returned
     * element directly.
     */
  private ensureStyleElement(): HTMLStyleElement {
    if (this.styleEl) {
      return this.styleEl;
    }

    const doc: Document = document;

    let host = doc.querySelector<HTMLElement>("hson-_style#css-manager");
    if (!host) {
      host = doc.createElement("hson-_style");
      host.id = "css-manager";
      doc.body.appendChild(host);
    }

    let styleEl = host.querySelector<HTMLStyleElement>("style#_hson");
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "_hson";
      host.appendChild(styleEl);
    }

    this.styleEl = styleEl;
    return styleEl;
  }

  public get atProperty(): PropertyManager {
    return this.atPropManager;
  }

  public get keyframes(): KeyframesManager {
    return this.keyframeManager;
  }

  // private buildQuidCss(): string {
  //   const blocks: string[] = [];

  //   for (const [quid, props] of this.rulesByQuid.entries()) {
  //     if (props.size === 0) continue;

  //     const decls: string[] = [];
  //     for (const [propCanon, value] of props.entries()) {
  //       const prop = canon_to_css_prop(propCanon);
  //       decls.push(`${prop}: ${value};`);
  //     }

  //     blocks.push(`${selectorForQuid(quid)} { ${decls.join(" ")} }`);
  //   }

  //   return blocks.join("\n\n");
  // }

  // --- WRITE API (QUID-based) -------------------------------------------

  public setForQuid(quid: string, propCanon: string, value: string): void {
    const q = quid.trim(); if (!q) return;
    const p = propCanon.trim(); if (!p) return;
    const v = String(value).trim();
    if (!v) {
      this.unsetForQuid(q, p);
      return;
    }
    let props = this.rulesByQuid.get(q);
    if (!props) {
      props = new Map();
      this.rulesByQuid.set(q, props);
    }

    props.set(p, v);
    this.mark_changed();
  }



  public anim_for_quids(quids: readonly string[]) {
    const scope: CssScope = { quids: quids.map(q => q.trim()).filter(Boolean) };

    const adapters: AnimAdapters<CssScope> = {
      setStyleProp: (sc: CssScope, prop: string, value: string): CssScope => {
        for (const quid of sc.quids) {
          this.setForQuid(quid, prop, value);
        }
        return sc;
      },

      // stylesheet-scoped: there are no DOM elements to iterate
      forEachDomElement: (_sc: CssScope, _fn: (el: Element) => void): void => {
        // no-op
      },

      getFirstDomElement: (_sc: CssScope): Element | undefined => {
        return undefined;
      },
    };

    const api: AnimApi<CssScope> = apply_animation<CssScope>(adapters);

    // Wrap so the consumer doesn't pass "tree" / scope
    return {
      begin: (spec: AnimationSpec): void => { api.begin(scope, spec); },
      beginName: (name: AnimationName): void => { api.beginName(scope, name); },
      end: (mode?: AnimationEndMode): void => { api.end(scope, mode); },

      restart: (spec: AnimationSpec): void => {
        // restart via stylesheet flush, not reflow
        api.end(scope, "name-only");
        this.syncToDom();
        api.begin(scope, spec);
        this.syncToDom();
      },

      restartName: (name: AnimationName): void => {
        api.end(scope, "name-only");
        this.syncToDom();
        api.beginName(scope, name);
        this.syncToDom();
      },
    } as const;
  }

  /* ????? do we change the below */


  /**
     * Set multiple properties for a single QUID in one call.
     *
     * - Trims the QUID once up front; throws if it becomes empty.
     * - Iterates `decls` and writes each trimmed property name into the
     *   QUID’s property map, normalizing values via `renderCssValue`.
     * - Skips properties whose names trim to `""`.
     * - Triggers a full stylesheet rebuild via `syncToDom()`.
     */
  public setManyForQuid(quid: string, decls: CssProp): void {
    const trimmedQuid = quid.trim();
    if (!trimmedQuid) {
      throw new Error("CssManager.setManyForQuid: quid must be non-empty");
    }

    let props = this.rulesByQuid.get(trimmedQuid);
    if (!props) {
      props = new Map<string, string>();
      this.rulesByQuid.set(trimmedQuid, props);
    }

    for (const [prop, v] of Object.entries(decls)) {
      const trimmedProp = prop.trim();
      if (!trimmedProp) {
        continue;
      }
      props.set(trimmedProp, renderCssValue(v));
    }

    this.syncToDom();
  }

  public unsetForQuid(quid: string, propCanon: string): void {
    const props = this.rulesByQuid.get(quid);
    if (!props) return;

    props.delete(propCanon);
    if (props.size === 0) this.rulesByQuid.delete(quid);

    this.mark_changed();
  }


  public clearQuid(quid: string): void {
    if (!this.rulesByQuid.delete(quid)) return;
    this.mark_changed();
  }

  public clearAll(): void {
    if (this.rulesByQuid.size === 0) return;
    this.rulesByQuid.clear();
    this.mark_changed();
  }
  
//   // --- READ / INTROSPECTION (QUID-based) --------------------------------
//   /**
//      * Check whether any rules exist for a given QUID.
//      */
//   public hasQuid(quid: string): boolean {
//     return this.rulesByQuid.has(quid);
//   }

//   /**
//      * Check whether a specific property is defined for a given QUID.
//      */
//   public hasPropForQuid(quid: string, property: string): boolean {
//     const props = this.rulesByQuid.get(quid);
//     return props ? props.has(property) : false;
//   }

//   /**
//  * Get the rendered value for a property on a given QUID, if present.
//  *
//  * @returns The CSS string value, or `undefined` if the QUID or property
//  *          has no rule.
//  */
//   public getPropForQuid(quid: string, property: string): string | undefined {
//     const props = this.rulesByQuid.get(quid);
//     return props ? props.get(property) : undefined;
//   }

//   /**
//      * Debug helper: render a single QUID’s CSS block as a string, e.g.:
//      *
//      *   `[data-_quid="…"] { width: 240px; transform: …; }`
//      *
//      * @returns `undefined` if the QUID has no properties.
//      */
//   public getQuidCss(quid: string): string | undefined {
//     const props = this.rulesByQuid.get(quid);
//     if (!props || props.size === 0) {
//       return undefined;
//     }

//     const decls: string[] = [];
//     for (const [prop, value] of props.entries()) {
//       decls.push(`${prop}: ${value};`);
//     }

//     const selector = selectorForQuid(quid);
//     return `${selector} { ${decls.join(" ")} }`;
//   }

//   /**
//     * Render the entire QUID rule set into a single CSS string.
//     *
//     * This is primarily intended for:
//     * - tests (snapshotting the stylesheet),
//     * - debug logging,
//     * - external tooling that wants to mirror the compiled rules.
//     */
//   public getCombinedCss(): string {
//     return this.buildCombinedCss();
//   }

  // --- INTERNAL: BUILD + SYNC -------------------------------------------
  /**
     * Build the full stylesheet text from `rulesByQuid`.
     *
     * Format:
     *   [data-_quid="..."] { prop1: value1; prop2: value2; }
     *
     * Each QUID becomes a separate rule block, separated by blank lines.
     */
  private buildCombinedCss(): string {
    const atPropCss = this.atPropManager.renderAll().trim();
    const keyframesCss = this.keyframeManager.renderAll().trim();

    const blocks: string[] = [];

    for (const [quid, props] of this.rulesByQuid.entries()) {
      if (props.size === 0) continue;

      const decls: string[] = [];
      for (const [propCanon, value] of props.entries()) {
        const prop = canon_to_css_prop(propCanon);
        decls.push(`${prop}: ${value};`);
      }

      blocks.push(`${selectorForQuid(quid)} { ${decls.join(" ")} }`);
    }

    const quidCss = blocks.join("\n\n").trim();

    const parts: string[] = [];
    if (atPropCss) parts.push(atPropCss);
    if (keyframesCss) parts.push(keyframesCss);
    if (quidCss) parts.push(quidCss);

    return parts.join("\n\n");
  }

  /**
     * Push the current compiled CSS into the backing `<style>` element.
     *
     * Called after every write operation so that DOM stays in lockstep with
     * the in-memory rule map.
     */
  private syncToDom(): void {
    const styleEl = this.ensureStyleElement();
    styleEl.textContent = this.buildCombinedCss();
  }
}