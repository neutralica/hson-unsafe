// css-manager.ts

import { _DATA_QUID } from "../../../types-consts/constants";
import { CssValue, CssProp, CssHandle } from "../../../types-consts/css.types";

/**
 * Build a QUID-scoped CSS handle for one or more HSON nodes.
 *
 * This is the core entrypoint used by `LiveTree.css` and `TreeSelector.css`.
 *
 * Behavior:
 * - Trims incoming QUIDs and drops empties.
 * - If the resulting list is empty, returns a no-op handle where all methods
 *   (`set`, `setMany`, `unset`, `clear`) do nothing.
 * - Otherwise, returns a `CssHandle` that forwards calls into the global
 *   `CssManager` singleton for each QUID in the set.
 *
 * Semantics:
 * - `set(property, value)` and `setMany(decls)` *merge* into any existing
 *   rules for each QUID.
 * - `unset(property)` removes a single property but leaves other properties
 *   for that QUID intact.
 * - `clear()` removes *all* properties for each bound QUID.
 */
export function css_for_quids(quids: readonly string[]): CssHandle {
  const mgr = CssManager.invoke();
  const ids = quids.map(q => q.trim()).filter(Boolean);

  //  no-op handle if there’s no selection
  if (ids.length === 0) {
    return {
      set() { /* no-op */ },
      setMany() { /* no-op */ },
      unset() { /* no-op */ },
      clear() { /* no-op */ },
    };
  }

  return {
    //  apply to all selected QUIDs
    set(property: string, value: CssValue): void {
      for (const quid of ids) {
        mgr.setForQuid(quid, property, value);
      }
    },

    setMany(decls: CssProp): void {
      for (const quid of ids) {
        mgr.setManyForQuid(quid, decls);
      }
    },

    unset(property: string): void {
      for (const quid of ids) {
        mgr.unsetForQuid(quid, property);
      }
    },

    clear(): void {
      for (const quid of ids) {
        mgr.clearQuid(quid);
      }
    },
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

  private constructor() { }

  public static invoke(): CssManager {
    if (!CssManager.instance) {
      CssManager.instance = new CssManager();
    }
    return CssManager.instance;
  }
  /**
     * Ensure the backing `<style>` element exists in the document and return it.
     *
     * Structure:
     *   <hson_style id="css-manager">
     *     <style id="_hson">…compiled QUID rules…</style>
     *   </hson_style>
     *
     * This is internal to `CssManager`; callers should not mutate the returned
     * element directly.
     */
  private ensureStyleElement(): HTMLStyleElement {
    if (this.styleEl) {
      return this.styleEl;
    }

    const doc: Document = document;

    let host = doc.querySelector<HTMLElement>("hson_style#css-manager");
    if (!host) {
      host = doc.createElement("hson_style");
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

  // --- WRITE API (QUID-based) -------------------------------------------


  /**
     * Set a single property for a single QUID.
     *
     * - `quid` and `property` are trimmed and must be non-empty.
     * - `value` is normalized via `renderCssValue` (string pass-through or
     *   `{value, unit}` join).
     * - Merges into any existing rule for that QUID (does not clear others).
     * - Triggers a full stylesheet rebuild via `syncToDom()`.
     */
  public setForQuid(quid: string, property: string, value: CssValue): void {
    const trimmedQuid = quid.trim();
    const trimmedProp = property.trim();

    if (!trimmedQuid) {
      throw new Error("CssManager.setForQuid: quid must be non-empty");
    }
    if (!trimmedProp) {
      throw new Error("CssManager.setForQuid: property must be non-empty");
    }

    const rendered: string = renderCssValue(value);

    let props = this.rulesByQuid.get(trimmedQuid);
    if (!props) {
      props = new Map<string, string>();
      this.rulesByQuid.set(trimmedQuid, props);
    }

    props.set(trimmedProp, rendered);
    this.syncToDom();
  }


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


  /**
     * Remove a single property for a given QUID.
     *
     * - If the QUID has no rule map, this is a no-op.
     * - If the property removal leaves the map empty, the QUID entry is
     *   removed entirely.
     * - Always triggers a stylesheet rebuild.
     */
  public unsetForQuid(quid: string, property: string): void {
    const props = this.rulesByQuid.get(quid);
    if (!props) {
      return;
    }

    props.delete(property);

    if (props.size === 0) {
      this.rulesByQuid.delete(quid);
    }

    this.syncToDom();
  }

  /**
     * Remove all properties for a given QUID.
     *
     * - If the QUID has no entry, this is a no-op.
     * - Otherwise, removes the QUID from `rulesByQuid` and rebuilds the CSS.
     */
  public clearQuid(quid: string): void {
    if (!this.rulesByQuid.has(quid)) {
      return;
    }
    this.rulesByQuid.delete(quid);
    this.syncToDom();
  }


  /**
     * Clear all QUID-scoped rules from the manager and the DOM.
     *
     * - If there are no rules, returns early.
     * - Otherwise, empties the internal map and clears the `<style>` content.
     */
  public clearAll(): void {
    if (this.rulesByQuid.size === 0) {
      return;
    }
    this.rulesByQuid.clear();
    this.syncToDom();
  }

  // --- READ / INTROSPECTION (QUID-based) --------------------------------
  /**
     * Check whether any rules exist for a given QUID.
     */
  public hasQuid(quid: string): boolean {
    return this.rulesByQuid.has(quid);
  }

  /**
     * Check whether a specific property is defined for a given QUID.
     */
  public hasPropForQuid(quid: string, property: string): boolean {
    const props = this.rulesByQuid.get(quid);
    return props ? props.has(property) : false;
  }

  /**
 * Get the rendered value for a property on a given QUID, if present.
 *
 * @returns The CSS string value, or `undefined` if the QUID or property
 *          has no rule.
 */
  public getPropForQuid(quid: string, property: string): string | undefined {
    const props = this.rulesByQuid.get(quid);
    return props ? props.get(property) : undefined;
  }

  /**
     * Debug helper: render a single QUID’s CSS block as a string, e.g.:
     *
     *   `[data-_quid="…"] { width: 240px; transform: …; }`
     *
     * @returns `undefined` if the QUID has no properties.
     */
  public getQuidCss(quid: string): string | undefined {
    const props = this.rulesByQuid.get(quid);
    if (!props || props.size === 0) {
      return undefined;
    }

    const decls: string[] = [];
    for (const [prop, value] of props.entries()) {
      decls.push(`${prop}: ${value};`);
    }

    const selector = selectorForQuid(quid);
    return `${selector} { ${decls.join(" ")} }`;
  }

  /**
    * Render the entire QUID rule set into a single CSS string.
    *
    * This is primarily intended for:
    * - tests (snapshotting the stylesheet),
    * - debug logging,
    * - external tooling that wants to mirror the compiled rules.
    */
  public getCombinedCss(): string {
    return this.buildCombinedCss();
  }

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
    const blocks: string[] = [];

    for (const [quid, props] of this.rulesByQuid.entries()) {
      if (props.size === 0) {
        continue;
      }

      const decls: string[] = [];
      for (const [prop, value] of props.entries()) {
        decls.push(`${prop}: ${value};`);
      }

      const selector = selectorForQuid(quid);
      const body = decls.join(" ");
      blocks.push(`${selector} { ${body} }`);
    }

    return blocks.join("\n\n");
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