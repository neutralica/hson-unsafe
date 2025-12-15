// css-manager.ts

import { PropertyManager } from "../../../types-consts/at-property.types";
import { $HSON_FRAME, _DATA_QUID, $_FALSE, _TRANSIT_ATTRS, _TRANSIT_PREFIX } from "../../../types-consts/constants";
import { CssValue, CssProp, CssHandle } from "../../../types-consts/css.types";
import { apply_animation, CssScope, normalizeName } from "./animate";
import { AnimAdapters, AnimApi, AnimationEndMode, AnimationName, AnimationSpec, CssAnimHandle } from "./animate.types";
import { manage_property } from "./at-property";
import { KeyframesManager, manage_keyframes } from "./keyframes";
import { AllowedStyleKey } from "./style-manager";
import { make_style_setter, StyleSetter, StyleValue } from "./style-setter";

type CssAnimScope = Readonly<{ quids: readonly string[] }>;
/* DEBUG - remove */
const CSS_HOST_TAG = "hson-_style";
const CSS_HOST_ID = "css-manager";
const CSS_STYLE_ID = "_hson";

export type SetSurface<Next> =
  // enumerated known CSSStyleDeclaration keys → rich autocomplete
  { [K in AllowedStyleKey]: (v: StyleValue) => Next }
  // allow these via bracket access too
  & Record<`--${string}`, (v: StyleValue) => Next>
  & Record<`${string}-${string}`, (v: StyleValue) => Next>
  // convenience
  & { var: (name: `--${string}`, v: StyleValue) => Next };

export function css_for_quids(quids: readonly string[]): CssHandle {
  const mgr = CssManager.invoke();
  const ids = quids.map(q => q.trim()).filter(Boolean);

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

  // CHANGED: devSnapshot is a method that computes at call time
  return {
    ...setter,
    atProperty: mgr.atProperty,   // keep whichever names you actually have
    keyframes: mgr.keyframes,
    anim: mgr.animForQuids(ids),
    devSnapshot: () => mgr.devSnapshot(),
    devReset: () => mgr.devReset(),
    devFlush: () => mgr.devFlush(),
  };
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
 * - Provides both write APIs (`setForQuid`, `setMany`, `unsetForQuid`,
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
  private readonly atPropManager: PropertyManager;
  private readonly keyframeManager: KeyframesManager;
  private changed = false;
  private scheduled = false;
  private boundDoc: Document | null = null;

  private constructor() {
    this.atPropManager = manage_property({ onChange: () => this.mark_changed() });
    this.keyframeManager = manage_keyframes({ onChange: () => this.mark_changed() });
  }


  private mark_changed(): void {
    this.changed = true;
    if (this.scheduled) return;

    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (!this.changed) return;
      this.changed = false;
      this.syncToDom();
    });
  }
  public static invoke(): CssManager {
    if (!CssManager.instance) CssManager.instance = new CssManager();
    // ensure host <style> exists immediately 
    CssManager.instance.ensureStyleElement();
    return CssManager.instance;
  }


  private ensureStyleElement(): HTMLStyleElement {
    const doc: Document = document;

    // CHANGED: if happy-dom swapped the global document, drop cached nodes AND clear state
    if (this.boundDoc !== doc) {
      this.boundDoc = doc;
      this.styleEl = null;

      // CHANGED: prevent stale rules replaying into the new document
      this.rulesByQuid.clear();

      // CHANGED: reset the manager state too (whatever the managers expose)
      this.atPropManager?.clear?.();
      this.keyframeManager?.clear?.();

      this.changed = true;
      this.scheduled = false;
    }


    // CHANGED: if cached styleEl exists but is detached or from a different doc, drop it
    if (this.styleEl) {
      if (!this.styleEl.isConnected || this.styleEl.ownerDocument !== doc) {
        this.styleEl = null;
      } else {
        return this.styleEl;
      }
    }

    // CHANGED: choose a mount point that is actually in the document tree
    const mount =
      (doc.head && doc.head.isConnected ? doc.head : null) ??
      (doc.body && doc.body.isConnected ? doc.body : null) ??
      doc.documentElement;

    if (!mount) {
      throw new Error("CssManager.ensureStyleElement: document has no mount point");
    }

    let host = doc.querySelector<HTMLElement>(`${CSS_HOST_TAG}#${CSS_HOST_ID}`);
    if (!host) {
      host = doc.createElement(CSS_HOST_TAG);
      host.id = CSS_HOST_ID;

      // CHANGED: append to the *connected* mount, not “head exists”
      mount.appendChild(host);
    }

    let styleEl = host.querySelector<HTMLStyleElement>(`style#${CSS_STYLE_ID}`);
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = CSS_STYLE_ID;
      host.appendChild(styleEl);
    }

    this.styleEl = styleEl;
    return styleEl;
  }

  // TODO make private once dev helpers are formalized
  public devSnapshot(): string {
    const cssText = this.buildCombinedCss();
    const styleEl = this.ensureStyleElement();
    styleEl.textContent = cssText;
    this.changed = false;
    return cssText;
  }

  // TODO make private once dev helpers are formalized
  public devReset(): void {
    this.rulesByQuid.clear();
    this.changed = false;
    this.scheduled = false;

    const styleEl = this.ensureStyleElement();
    styleEl.textContent = "";
  }

  // TODO make private once dev helpers are formalized
  public devFlush(): void {
    this.syncToDom();
  }

  private makeAnimAdapters(): AnimAdapters<CssAnimScope> {
    return {
      // 1) set a single CSS property for every QUID in the scope
      setStyleProp: (scope, prop, value) => {
        for (const quid of scope.quids) {
          this.setForQuid(quid, prop, value);
        }
        return scope;
      },

      // 2) iterate DOM elements for the selection
      forEachDomElement: (scope, fn) => {
        for (const quid of scope.quids) {
          const el = document.querySelector(selectorForQuid(quid));
          if (el) fn(el);
        }
      },

      // 3) return one element (first match) for minimal reflow poke
      getFirstDomElement: (scope) => {
        for (const quid of scope.quids) {
          const el = document.querySelector(selectorForQuid(quid));
          if (el) return el;
        }
        return undefined;
      },
    };
  }

  public get atProperty(): PropertyManager {
    this.ensureStyleElement();
    return this.atPropManager;
  }

  public get keyframes(): KeyframesManager {
    this.ensureStyleElement();
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
    const q = quid.trim();
    if (!q) return;

    const map = this.rulesByQuid.get(q) ?? new Map<string, string>();
    this.rulesByQuid.set(q, map);

    // CHANGED: ensure value is a string, never "[object Object]"
    map.set(propCanon, String(value));

    this.changed = true;
    this.mark_changed
    this.scheduled = true;
  }



  public animForQuids(quids: readonly string[]): CssAnimHandle {
    this.ensureStyleElement();
    const api = apply_animation(this.makeAnimAdapters());
    const scope: CssAnimScope = { quids };

    return {
      begin: (spec) => { api.begin(scope, spec); },
      restart: (spec) => { api.restart(scope, spec); },
      beginName: (name) => { api.beginName(scope, name); },
      restartName: (name) => { api.restartName(scope, name); },
      end: (mode) => { api.end(scope, mode); },
    };
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
    console.log('set many for quid! reached')
    this.ensureStyleElement();
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
    this.ensureStyleElement();
    const props = this.rulesByQuid.get(quid);
    if (!props) return;

    props.delete(propCanon);
    if (props.size === 0) this.rulesByQuid.delete(quid);

    this.mark_changed();
  }


  public clearQuid(quid: string): void {
    this.ensureStyleElement();
    if (!this.rulesByQuid.delete(quid)) return;
    this.mark_changed();
  }

  public clearAll(): void {
    this.ensureStyleElement();
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

  private compileQuidRules(): string {
    const parts: string[] = [];

    for (const [quid, rules] of this.rulesByQuid.entries()) {
      if (!rules || rules.size === 0) continue;

      const decls: string[] = [];
      for (const [prop, value] of rules.entries()) {
        // CHANGED: skip nullish/empty removals defensively
        if (value == null) continue;
        decls.push(`${prop}: ${value};`);
      }

      if (decls.length === 0) continue;

      parts.push(`${selectorForQuid(quid)} { ${decls.join(" ")} }`);
    }

    return parts.join("\n");
  }


  private syncToDom(): void {
    if (!this.changed) return;
    const styleEl = this.ensureStyleElement();
    // one-block-per-quid compilation
    const quidCss = this.compileQuidRules();
    const atPropCss = this.atPropManager.renderAll?.() ?? "";
    const keyframesCss = this.keyframeManager.renderAll?.() ?? "";
    const cssText = [atPropCss, keyframesCss, quidCss].filter(Boolean).join("\n");
    styleEl.textContent = cssText;
    this.changed = false;
    console.log("[CssManager.syncToDom]", {
      quids: this.rulesByQuid.size,
      rulesTotal: Array.from(this.rulesByQuid.values()).reduce((n, m) => n + m.size, 0),
      changed: this.changed,
      scheduled: this.scheduled,
      cssLen: this.styleEl?.textContent?.length ?? 0,
    });
  }
}
