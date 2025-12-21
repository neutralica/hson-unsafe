// css-manager.ts

import { PropertyManager } from "../../../types-consts/at-property.types";
import { _DATA_QUID } from "../../../types-consts/constants";
import { CssValue, CssProp, CssHandle, AllowedStyleKey } from "../../../types-consts/css.types";
import { apply_animation, bind_anim_api } from "./animate";
import { AnimAdapters, CssAnimHandle, CssAnimScope } from "./animate.types";
import { manage_property } from "./at-property";
import { KeyframesManager, manage_keyframes } from "./keyframes";
import { make_style_setter } from "./style-setter";

const CSS_HOST_TAG = "hson-_style";
const CSS_HOST_ID = "css-manager";
const CSS_STYLE_ID = "_hson";

/**
 * Proxy-call surface used by `StyleSetter.set`.
 *
 * This is a *type-level* convenience that provides ergonomic calls like:
 *   `handle.set.backgroundColor("aquamarine")`
 * while still permitting:
 *   `handle.set["background-color"]("aquamarine")`
 *   `handle.set.var("--k", 1)`
 *
 * `Next` is typically the handle type itself (for chaining).
 */
export type SetSurface<Next> =
  // enumerated known CSSStyleDeclaration keys → rich autocomplete
  { [K in AllowedStyleKey]: (v: CssValue) => Next }
  // allow these via bracket access too
  & Record<`--${string}`, (v: CssValue) => Next>
  & Record<`${string}-${string}`, (v: CssValue) => Next>
  // convenience
  & { var: (name: `--${string}`, v: CssValue) => Next };


/**
 * Create a multi-QUID CSS handle.
 *
 * This is the main entrypoint for “stylesheet-backed” styling. It produces a `CssHandle`
 * whose core mutation surface is a `StyleSetter` wired to `CssManager`:
 *
 * - `apply(prop, value)` writes `prop: value` into each QUID’s rule block
 * - `remove(prop)` removes that property from each QUID’s rule block
 * - `clear()` deletes each QUID’s rule block entirely
 *
 * The returned handle may also expose additional manager capabilities (e.g. `atProperty`,
 * `keyframes`, animation helpers, and dev tooling snapshots) as pass-throughs.
 *
 * @param quids List of QUID strings to target. Empty/whitespace entries are ignored.
 * @returns A `CssHandle` that broadcasts style mutations to all provided QUIDs.
 * @see make_style_setter
 * @see CssManager
 */
export function css_for_quids(quids: readonly string[]): CssHandle {
  const mgr = CssManager.invoke();
  const ids = quids.map(q => q.trim()).filter(Boolean);

  const setter = make_style_setter({
    apply: (propCanon, value) => {
      for (const quid of ids) mgr.setForQuid(quid, propCanon, value);
    },
    remove: (propCanon) => {
      for (const quid of ids) mgr.unsetForQuid(quid, propCanon);
    },
    clear: () => {
      for (const quid of ids) mgr.clearQuid(quid);
    },
  });

  //  devSnapshot is a method that computes at call time
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
 * Equivalent to calling `css_for_quids([quid])`.
 *
 * @param quid QUID to target.
 * @returns A `CssHandle` targeting exactly one QUID.
 * @see css_for_quids
 */
export function css_for_quid(quid: string): CssHandle {   // NEW
  return css_for_quids([quid]);
}

/**
 * Render a `CssValue` into a CSS literal string.
 *
 * - `string` values are trimmed and returned as-is.
 * - `{ value, unit }` values are rendered as `${value}${unit}` with the special unit `"_"` meaning
 *   “no unit” (e.g. `{value: 1, unit: "_"}` → `"1"`).
 *
 * This is used in the stylesheet-backed pipeline (CssManager) to produce stable rule text.
 *
 * @param v A `CssValue` to render.
 * @returns A CSS-ready literal string (no surrounding property name).
 */
function renderCssValue(v: CssValue): string {
  // string → already a valid CSS literal
  if (typeof v === "string") {
    return v.trim();
  }
  if (
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    !v
  ) {
    return '';
  }

  // object → { value, unit } → e.g. "12px", "1.5rem"
  const unit = v.unit === "_" ? "" : v.unit;
  return `${v.value}${unit}`;
}

/**
 * Map a QUID to the canonical CSS selector used by CssManager.
 *
 * This function centralizes the selector scheme so it stays consistent across:
 * - rule creation,
 * - rule updates,
 * - dev snapshots / debugging output.
 *
 * @param quid QUID to target.
 * @returns A selector string of the form `[data-_quid="..."]` (or whatever `_DATA_QUID` encodes).
 */
function selectorForQuid(quid: string): string {
  // SINGLE place where we define how a QUID maps to a CSS selector
  return `[${_DATA_QUID}="${quid}"]`;
}

/**
 * Convert a canonical property identifier into the exact CSS property name used in rule text.
 *
 * Rules:
 * - Custom properties (`--foo`) are returned unchanged.
 * - Keys already containing `-` are treated as kebab-case and returned unchanged.
 * - Otherwise, camelCase is converted to kebab-case.
 *
 * This exists to keep the StyleSetter-facing API flexible (camel or kebab in calls) while ensuring
 * CssManager emits stable, correct CSS text.
 *
 * @param propCanon Canonical property identifier (camelCase, kebab-case, or `--var`).
 * @returns The CSS property name to emit into a stylesheet rule.
 */
function canon_to_css_prop(propCanon: string): string {
  // CSS custom properties keep their spelling
  if (propCanon.startsWith("--")) return propCanon;

  // Already kebab (your StyleKey allowed `${string}-${string}`)
  if (propCanon.includes("-")) return propCanon;

  // camelCase -> kebab-case
  return propCanon.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

/**
 * Singleton manager for QUID-scoped stylesheet rules.
 *
 * `CssManager` owns the “stylesheet-backed” side of styling in HSON/LiveTree.
 * Rather than mutating inline `style=""`, it maintains an in-memory rule model:
 *
 *   QUID → (canonicalCssProp → renderedValue)
 *
 * and renders that model into a single `<style>` element in the active `document`.
 * Each QUID maps to one selector (via `selectorForQuid`), producing blocks like:
 *
 *   [data-_quid="…"] { opacity: 0.5; transform: translate(…); }
 *
 * Integration points:
 * - `css_for_quids()` creates a `CssHandle` by wiring a `StyleSetter` to this manager.
 *   The handle exposes a fluent surface (`setProp`, `setMany`, `remove`, `clear`, `set.*`)
 *   whose adapter methods call into `CssManager` (e.g. `setForQuid`, `unsetForQuid`).
 * - `PropertyManager` and `KeyframesManager` are owned sub-managers. Their `onChange`
 *   callbacks mark the stylesheet “dirty” and trigger a re-render so at-rules and
 *   keyframes stay in sync with the rule model.
 *
 * DOM contract:
 * - On first use, `invoke()` ensures a host container exists:
 *     `<hson-_style id="css-manager"> … </hson-_style>`
 *   and that it contains:
 *     `<style id="_hson"> … </style>`
 * - Rendering targets the *current* global `document`. If the document identity
 *   changes (e.g. test harness swapping `globalThis.document`), `CssManager`
 *   drops cached DOM references and resets internal state so rules and managers
 *   are not leaked across documents.
 *
 * Render policy:
 * - Mutations mark the manager as changed and schedule/perform a sync to DOM.
 *   (Exact batching behavior depends on `syncToDom()` implementation.)
 * - Output is deterministic where possible (e.g. sorted keys) to make diffs and
 *   snapshots stable in tests.
 *
 * Error handling:
 * - Write APIs may throw on programmer errors such as blank QUIDs or invalid
 *   property identifiers, to fail fast during development.
 */
export class CssManager {
  private static instance: CssManager | null = null;
  // QUID → (property → rendered value)
  private readonly rulesByQuid: Map<string, Map<string, string>> = new Map();
  private styleEl: HTMLStyleElement | null = null;
  private atPropManager: PropertyManager;
  private keyframeManager: KeyframesManager;
  private changed = false;
  private scheduled = false;
  private boundDoc: Document | null = null;

  private constructor() {
    this.atPropManager = manage_property({ onChange: () => this.mark_changed() });
    this.keyframeManager = manage_keyframes({ onChange: () => this.mark_changed() });
  }
  /**
   * Marks the stylesheet state as updated and triggers a DOM sync.
   *
   * This is the single “invalidates + re-render” hook used by sub-managers
   * (`PropertyManager`, `KeyframesManager`) and by any rule write paths that
   * need to refresh the generated `<style>` text.
   *
   * Implementation note:
   * - This currently calls `syncToDom()` immediately. If you later introduce
   *   batching (e.g. microtask/RAF), this is the natural choke point to flip
   *   from “eager” to “scheduled” syncing.
   */
  private mark_changed(): void {
    this.changed = true;
    this.syncToDom();
  }

  /**
   * Returns the singleton `CssManager` instance, creating it on first use.
   *
   * Side effects:
   * - Ensures the manager is bound to a valid `<style>` element in the current
   *   global `document` (via `ensureStyleElement()`), so subsequent writes can
   *   safely render without a “first write creates DOM” race.
   *
   * @returns The process-wide `CssManager` singleton.
   */
  public static invoke(): CssManager {
    if (!CssManager.instance) CssManager.instance = new CssManager();
    // ensure host <style> exists immediately 
    CssManager.instance.ensureStyleElement();
    return CssManager.instance;
  }

  /**
   * Resets all in-memory CSS state and owned sub-managers to a clean baseline.
   *
   * This is primarily a test/host-environment safety valve:
   * - When the global `document` identity changes (e.g. Happy DOM replacing
   *   `globalThis.document`), previously cached DOM references and rule maps
   *   are no longer valid. This method clears rule state and recreates
   *   `@property` / keyframe managers so they are bound to the new document.
   *
   * Side effects:
   * - Clears all QUID-scoped rule maps.
   * - Clears internal scheduling/dirty flags.
   * - Reinitializes `PropertyManager` and `KeyframesManager` with fresh
   *   `onChange` hooks.
   * - If the current `<style>` element is still connected, empties its text.
   */
  private resetManagersAndRules(): void {
    this.rulesByQuid.clear();
    this.changed = false;
    this.scheduled = false;
    this.atPropManager = manage_property({ onChange: () => this.mark_changed() });
    this.keyframeManager = manage_keyframes({ onChange: () => this.mark_changed() });

    if (this.styleEl && this.styleEl.isConnected) {
      this.styleEl.textContent = "";
    }
  }

  /**
   * Ensures the manager has a live `<style>` element in the current `document`
   * and returns it.
   *
   * Responsibilities:
   * 1) Detect host-document swaps:
   *    - If `globalThis.document` is not the same object previously seen,
   *      cached DOM references are discarded and internal rule/manager state is
   *      reset to avoid leaking rules across documents.
   *
   * 2) Validate cached element:
   *    - If `this.styleEl` exists but is detached or belongs to a different
   *      document, it is discarded and recreated.
   *
   * 3) Create / locate the host container and style element:
   *    - Ensures a host element `${CSS_HOST_TAG}#${CSS_HOST_ID}` exists.
   *    - Ensures a child `<style id="${CSS_STYLE_ID}">` exists inside the host.
   *
   * 4) Mirror external resets:
   *    - If a test harness or caller manually clears the `<style>` text while
   *      the manager still has non-empty rule state, this method treats the DOM
   *      as authoritative and clears `rulesByQuid` to match.
   *
   * Mount policy:
   * - Prefers `document.head` when connected, otherwise `document.body`,
   *   otherwise `document.documentElement`. Throws if none are available.
   *
   * @throws Error if no connected mount point exists in the current document.
   * @returns The ensured `<style>` element used for rendered CSS output.
   */
  private ensureStyleElement(): HTMLStyleElement {
    const doc: Document = document;

    //  if happy-dom swapped the global document, drop cached nodes AND clear state
    if (this.boundDoc !== doc) {
      this.boundDoc = doc;
      this.styleEl = null;

      // reset rules and managers for the new document
      this.resetManagersAndRules();
    }


    //  if cached styleEl exists but is detached or from a different doc, drop it
    if (this.styleEl) {
      if (!this.styleEl.isConnected || this.styleEl.ownerDocument !== doc) {
        this.styleEl = null;
      } else {
        if (!this.changed && this.styleEl.textContent === "" && this.rulesByQuid.size > 0) {
          this.rulesByQuid.clear();
        }
        return this.styleEl;
      }
    }

    //  choose a mount point that is actually in the document tree
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

      //  append to the *connected* mount, not “head exists”
      mount.appendChild(host);
    }

    let styleEl = host.querySelector<HTMLStyleElement>(`style#${CSS_STYLE_ID}`);
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = CSS_STYLE_ID;
      host.appendChild(styleEl);
    }

    // If a test manually cleared the style tag, mirror that reset into memory.
    if (!this.changed && styleEl.textContent === "" && this.rulesByQuid.size > 0) {
      this.rulesByQuid.clear();
    }

    this.styleEl = styleEl;
    return styleEl;
  }

  /**
   * Dev-only helper that forces a full stylesheet render and returns the CSS text.
   *
   * Behavior:
   * - Builds the combined stylesheet text from all current manager state
   *   (QUID rules + `@property` registrations + keyframes/animations).
   * - Writes that text directly into the managed `<style id="${CSS_STYLE_ID}">`.
   * - Clears the internal dirty flag (`changed = false`).
   *
   * This is intentionally side-effecting and should be treated as an
   * introspection/diagnostic escape hatch (useful in tests and debugging).
   *
   * @returns The exact CSS text written into the managed `<style>` element.
   */
  public devSnapshot(): string {
    const cssText = this.buildCombinedCss();
    const styleEl = this.ensureStyleElement();
    styleEl.textContent = cssText;
    this.changed = false;
    return cssText;
  }

  /**
   * Dev-only helper that hard-resets all CSS state and re-ensures the DOM host.
   *
   * Behavior:
   * - Clears all QUID-scoped rules.
   * - Recreates the `@property` and keyframes managers.
   * - Empties the managed `<style>` element (if connected).
   * - Ensures the host + `<style>` element exist for the current `document`.
   *
   * This is primarily intended for tests (e.g. to avoid cross-test leakage)
   * and for manual debugging when the manager state must be rebuilt from zero.
   */
  public devReset(): void {
    this.resetManagersAndRules();
    this.ensureStyleElement();
  }

  /**
   * Dev-only helper that forces a DOM sync of the stylesheet.
   *
   * This bypasses any future batching/scheduling strategy by directly invoking
   * `syncToDom()`. Useful in tests or debugging when you want the `<style>` tag
   * to reflect the latest in-memory rules immediately.
   */
  public devFlush(): void {
    this.syncToDom();
  }

  /**
   * Constructs the adapter surface used by the animation subsystem for QUID scopes.
   *
   * The returned adapters translate generic animation operations into this
   * manager’s concrete mechanisms:
   * - style writes are routed through `setForQuid()` for each QUID in scope
   * - DOM pokes are performed by querying elements via `selectorForQuid()`
   *
   * Design intent:
   * - Keep the animation engine generic (it only knows about `scope`),
   *   while `CssManager` owns how scope maps to CSS rules and DOM elements.
   *
   * @returns An `AnimAdapters<CssAnimScope>` implementation bound to this manager.
   */
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

  /**
   * Exposes the `@property` registration manager used by this `CssManager`.
   *
   * Access guarantees:
   * - Ensures the managed `<style>` element exists for the current `document`
   *   before returning the manager, so subsequent registrations can be rendered.
   *
   * @returns The live `PropertyManager` instance (singleton-owned).
   */
  public get atProperty(): PropertyManager {
    this.ensureStyleElement();
    return this.atPropManager;
  }

  /**
   * Exposes the keyframes/animation definition manager used by this `CssManager`.
   *
   * Access guarantees:
   * - Ensures the managed `<style>` element exists for the current `document`
   *   before returning the manager, so keyframe writes can be rendered.
   *
   * @returns The live `KeyframesManager` instance (singleton-owned).
   */
  public get keyframes(): KeyframesManager {
    this.ensureStyleElement();
    return this.keyframeManager;

  }

  // --- WRITE API (QUID-based) -------------------------------------------
  /**
   * Sets (or unsets) a single CSS declaration for a specific QUID selector.
   *
   * Rules:
   * - `quid` and `propCanon` are trimmed; blank inputs are treated as no-ops.
   * - Values are normalized to a string:
   *   - primitives are stringified
   *   - `CssValue` objects are rendered by `renderCssValue`
   * - Delete semantics:
   *   - if rendering yields `null`, the property is removed
   *   - if the rendered string trims to `""`, the property is removed
   *   - `"0"` and other non-empty strings are preserved (not treated as delete)
   *
   * Side effects:
   * - Mutates the in-memory rules map for the QUID.
   * - Marks the stylesheet dirty and triggers a DOM sync via `mark_changed()`.
   *
   * @param quid The QUID whose selector will receive the declaration.
   * @param propCanon The canonical property key (e.g. `"opacity"`, `"--k"`).
   * @param value The value to assign; may be a primitive or a structured `CssValue`.
   */
  public setForQuid(
    quid: string,
    propCanon: string,
    value: CssValue | string | number | boolean
  ): void {
    this.ensureStyleElement();

    const q = quid.trim();
    if (!q) return;

    const p = propCanon.trim();
    if (!p) return;

    //  treat null-delete semantics only if renderCssValue returns null
    const rendered =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : renderCssValue(value); // <-- must return string or null

    //  explicit delete if null
    if (rendered === null) {
      this.unsetForQuid(q, p);
      return;
    }

    //  don't treat "0" as delete; only empty string deletes
    const v = rendered.trim();
    if (v.length === 0) {
      this.unsetForQuid(q, p);
      return;
    }

    let props = this.rulesByQuid.get(q);
    if (!props) {
      props = new Map<string, string>();
      this.rulesByQuid.set(q, props);
    }

    props.set(p, v);
    this.mark_changed();
  }

  /**
   * Creates an animation handle bound to a set of QUIDs.
   *
   * This wires the generic animation engine (`apply_animation`) to a concrete
   * QUID scope by providing adapters (via `makeAnimAdapters()`) that:
   * - write animation-related CSS properties through `setForQuid()`
   * - locate and poke DOM elements via `selectorForQuid()`
   *
   * The returned handle is intentionally small and explicit: callers can begin,
   * restart, or end animations either by spec or by animation-name.
   *
   * @param quids The QUIDs that comprise the animation scope.
   * @returns A `CssAnimHandle` that controls animations for that scope.
   */
  public animForQuids(quids: readonly string[]): CssAnimHandle {
    this.ensureStyleElement();

    const core = apply_animation(this.makeAnimAdapters()); // AnimApiCore<CssAnimScope>
    const scope: CssAnimScope = { quids };

    return bind_anim_api(scope, core); // AnimApi<CssAnimScope>
  }

  /**
   * Sets multiple CSS declarations for a single QUID in one call.
   *
   * Notes:
   * - This is a bulk-write convenience API over the per-QUID rule map.
   * - Unlike `setForQuid`, it currently throws on a blank/whitespace QUID
   *   (programmer error), and it syncs via `syncToDom()` directly.
   *
   * Behavior:
   * - Trims and validates `quid`.
   * - Ensures a per-QUID property map exists.
   * - Iterates `decls` and writes each non-blank property name after trimming.
   * - Renders each value using `renderCssValue`.
   * - Forces a stylesheet rebuild via `syncToDom()`.
   *
   * @param quid The QUID whose selector will receive the declarations.
   * @param decls A property map (already canonicalized at the call site).
   * @throws Error if `quid` is blank after trimming.
   */
  public setManyForQuid(quid: string, decls: CssProp): void {
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

  /**
   * Removes a single CSS declaration for a specific QUID selector.
   *
   * Behavior:
   * - If the QUID has no rule map, this is a no-op.
   * - If removing the property empties the QUID’s rule map, the QUID entry
   *   is removed entirely.
   * - Marks the stylesheet dirty and triggers a DOM sync via `mark_changed()`.
   *
   * @param quid The QUID whose selector will have the property removed.
   * @param propCanon The canonical property key to remove.
   */
  public unsetForQuid(quid: string, propCanon: string): void {
    this.ensureStyleElement();
    const props = this.rulesByQuid.get(quid);
    if (!props) return;

    props.delete(propCanon);
    if (props.size === 0) this.rulesByQuid.delete(quid);

    this.mark_changed();
  }

  /**
   * Removes all CSS declarations for a specific QUID selector.
   *
   * Behavior:
   * - No-ops if the QUID has no entry.
   * - Marks the stylesheet dirty and triggers a DOM sync via `mark_changed()`
   *   only when something was actually cleared.
   *
   * @param quid The QUID whose entire rule block should be removed.
   */
  public clearQuid(quid: string): void {
    this.ensureStyleElement();
    if (!this.rulesByQuid.delete(quid)) return;
    this.mark_changed();
  }

  /**
   * Clears all QUID-scoped CSS declarations managed by this instance.
   *
   * Behavior:
   * - No-ops if no rules are stored.
   * - Clears the entire `rulesByQuid` map.
   * - Marks the stylesheet dirty and triggers a DOM sync via `mark_changed()`.
   *
   * This does not reset `@property` registrations or keyframe definitions.
   * Use `devReset()` (or an explicit manager reset path) when you need a full
   * reset of all CSS-related state.
   */
  public clearAll(): void {
    this.ensureStyleElement();
    if (this.rulesByQuid.size === 0) return;
    this.rulesByQuid.clear();
    this.mark_changed();
  }

  // --- INTERNAL: BUILD + SYNC -------------------------------------------
  /**
 * Builds the complete stylesheet text managed by `CssManager`.
 *
 * Composition order:
 * 1) `@property` registrations (from `atPropManager.renderAll()`)
 * 2) keyframes / animation definitions (from `keyframeManager.renderAll()`)
 * 3) QUID-scoped rule blocks (from `rulesByQuid`)
 *
 * QUID rule format:
 * - Each QUID **must** emit exactly one selector block:
 *   `[data-_quid="..."] { prop: value; ... }`
 * - Properties are stored internally as *canonical* keys (camelCase, kebab-case,
 *   or `--custom-prop`) and are converted to emitted CSS property names via
 *   `canon_to_css_prop()`.
 * - Values in `rulesByQuid` are **final rendered strings** (no `{value, unit}`
 *   objects survive into this map). A defensive invariant check enforces this.
 *
 * Determinism:
 * - This function is pure with respect to DOM (string-in/string-out).
 * - Output ordering is defined by the iteration order of `rulesByQuid` and each
 *   per-QUID property map; if you need strict stability across runs, ensure
 *   insertion order is deterministic or sort keys before emitting.
 *
 * @returns The full stylesheet text ready to assign to `<style>.textContent`.
 * @throws Error If an invariant check detects a non-string value in `rulesByQuid`.
 */
  private buildCombinedCss(): string {
    // INVARIANT:
    // Each QUID MUST emit exactly one selector block.
    // rulesByQuid is Map<quid, Map<prop, string>> and MUST be folded
    // into a single `[data-_quid="..."] { ... }` block.
    // Do NOT emit per-property selector blocks.
    //
    // Boundary: rulesByQuid stores final rendered strings only (no objects).

    // Optional guard (no process.env):
    for (const [quid, rules] of this.rulesByQuid) {
      for (const [prop, val] of rules) {
        if (typeof val !== "string") {
          throw new Error(
            `CssManager invariant violated: non-string value at ${quid}.${prop}`
          );
        }
      }
    }
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
   * Synchronizes the current in-memory CSS state into the managed `<style>` tag.
   *
   * Behavior:
   * - Ensures the host `<style id="${CSS_STYLE_ID}">` exists for the current `document`
   *   via `ensureStyleElement()`.
   * - Rebuilds the full stylesheet text via `buildCombinedCss()` and assigns it to
   *   `styleEl.textContent` (full overwrite, not incremental patching).
   * - Clears the dirty flag (`changed = false`).
   *
   * Notes:
   * - This is the single “write-to-DOM” choke point for the manager.
   * - Callers typically reach this via `mark_changed()` (and any batching strategy
   *   should live there, not here).
   */
  private syncToDom(): void {
    const styleEl = this.ensureStyleElement();
    styleEl.textContent = this.buildCombinedCss();
    this.changed = false;

  }
}
