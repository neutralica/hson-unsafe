import { _DATA_QUID } from "../../../types-consts/constants";
import { CssValue, CssProp } from "../../../types-consts/css-manager-types";

// NEW: public-facing handle for callers
export interface CssHandle {
  // apply to all bound QUIDs
  set(property: string, value: CssValue): void;         // NEW
  setMany(decls: CssProp): void;                        // NEW
  unset(property: string): void;                        // NEW
  clear(): void;                                        // NEW
}

// NEW: core helper – returns a handle bound to one or many QUIDs
export function cssForQuids(quids: readonly string[]): CssHandle {
  const mgr = CssManager.invoke();
  const ids = quids.map(q => q.trim()).filter(Boolean);

  // NEW: no-op handle if there’s no selection
  if (ids.length === 0) {
    return {
      set() { /* no-op */ },
      setMany() { /* no-op */ },
      unset() { /* no-op */ },
      clear() { /* no-op */ },
    };
  }

  return {
    // NEW: apply to all selected QUIDs
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

// OPTIONAL: convenience for a single quid
export function cssForQuid(quid: string): CssHandle {   // NEW
  return cssForQuids([quid]);
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

// singleton CSS manager that owns the global HSON stylesheet
export class CssManager {
  private static instance: CssManager | null = null;

  // QUID → (property → rendered value)
  private readonly rulesByQuid: Map<string, Map<string, string>> = new Map();

  private styleEl: HTMLStyleElement | null = null;

  private constructor() {}

  public static invoke(): CssManager {
    if (!CssManager.instance) {
      CssManager.instance = new CssManager();
    }
    return CssManager.instance;
  }

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

  // Set a single property for a QUID
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

  // Set multiple properties for a QUID at once
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

  // Remove a single property for a QUID
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

  // Remove all properties for a QUID
  public clearQuid(quid: string): void {
    if (!this.rulesByQuid.has(quid)) {
      return;
    }
    this.rulesByQuid.delete(quid);
    this.syncToDom();
  }

  // Clear everything
  public clearAll(): void {
    if (this.rulesByQuid.size === 0) {
      return;
    }
    this.rulesByQuid.clear();
    this.syncToDom();
  }

  // --- READ / INTROSPECTION (QUID-based) --------------------------------

  public hasQuid(quid: string): boolean {
    return this.rulesByQuid.has(quid);
  }

  public hasPropForQuid(quid: string, property: string): boolean {
    const props = this.rulesByQuid.get(quid);
    return props ? props.has(property) : false;
  }

  public getPropForQuid(quid: string, property: string): string | undefined {
    const props = this.rulesByQuid.get(quid);
    return props ? props.get(property) : undefined;
  }

  // Debug helper: CSS block for this QUID as a string
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

  // Full combined CSS for debugging/tests
  public getCombinedCss(): string {
    return this.buildCombinedCss();
  }

  // --- INTERNAL: BUILD + SYNC -------------------------------------------

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

  private syncToDom(): void {
    const styleEl = this.ensureStyleElement();
    styleEl.textContent = this.buildCombinedCss();
  }
}