// style-setter.ts

import { CssMap, CssValue } from "../../../types-consts/css.types";
import { nrmlz_cssom_prop_key } from "../../../utils/attrs-utils/normalize-css";
import { SetSurface } from "./css-manager";
import { CssKey } from "../../../types-consts/css.types";


/**
 * Fluent write surface for styles.
 *
 * A `StyleSetter` is a *handle* bound to some target (one element’s inline style,
 * one QUID-scoped CSS rule block, a multi-selection broadcast, etc.).
 *
 * The same API is used across backends; differences live behind `StyleSetterAdapters`.
 *
 * - `setProp` / `setMany` write values.
 * - `remove` deletes a single property.
 * - `clear` deletes all properties for the handle.
 * - `set` is a Proxy-based convenience surface (`setter.set.backgroundColor("...")`).
 *
 * All methods return the same `StyleSetter` for chaining.
 */
export type StyleSetter = Readonly<{
  /** Proxy builder: setter.set.backgroundColor("aquamarine") */
  set: SetSurface<StyleSetter>;

  /** stringly escape hatch (accepts camelCase or kebab-case) */
  setProp: (prop: CssKey, v: CssValue) => StyleSetter;

  /** set many props from an object (keys may be camel or kebab) */
  setMany: (map: CssMap) => StyleSetter;

  /** remove one prop (accepts camelCase or kebab-case) */
  remove: (prop: CssKey) => StyleSetter;

  /** clear all props for this handle */
  clear: () => StyleSetter;
}>;

/**
 * Backend interface used by `make_style_setter()` to perform actual writes.
 *
 * This is the “bridge” between the generic fluent API (`StyleSetter`) and a concrete style backend
 * (inline style via `StyleManager`, QUID-scoped stylesheet rules via `CssManager`, etc.).
 *
 * ## Invariants expected by implementers
 * - `propCanon` is already normalized to canonical CSS form (kebab-case or `--custom-prop`).
 * - `value` is already rendered to a string (no additional coercion should be needed).
 * - `remove()` and `clear()` should be idempotent (safe to call repeatedly).
 *
 * Implementers are responsible for:
 * - choosing the storage/write strategy (DOM `style=""`, CSSStyleRule text, etc.),
 * - ensuring the target exists (or no-op if it does not),
 * - updating any “dirty” flags / re-render triggers used by the backend.
 */
export type StyleSetterAdapters = Readonly<{
  /**
   * Apply a single *canonical* property (camelCase or --var) with a rendered string value.
   * `value` is already normalized/rendered when this is called.
   */
  apply: (propCanon: string, value: string) => void;

  /** Remove a single *canonical* property. */
  remove: (propCanon: string) => void;

  /** Clear all properties for this handle. */
  clear: () => void;

  /**
   * Optional: allowlist keys for the proxy builder (autocomplete/constraints).
   * If omitted, the proxy allows any property string.
   */
  keys?: readonly string[];
}>;

/**
 * Create a `StyleSetter`: a small, fluent, backend-agnostic “write surface” for CSS style.
 *
 * ## What this is
 * `StyleSetter` is intentionally dumb: it holds **no state** and performs **no DOM/CSSOM logic**
 * itself. It only:
 *  1) normalizes property keys to a canonical CSS form, and
 *  2) renders/coerces values into strings (or “remove”),
 * then delegates the actual write/remove/clear work to the provided `adapters`.
 *
 * ## Where it sits in the system (wiring diagram)
 * - `LiveTree.style` / `TreeSelector.style` typically returns a `StyleSetter` backed by a
 *   `StyleManager` adapter (inline style on the element).
 * - `LiveTree.css` / `TreeSelector.css` typically returns a `StyleSetter` backed by a
 *   `CssManager` adapter (QUID-scoped rules in a stylesheet).
 *
 * That means: the *same* fluent API (setProp/setMany/remove/clear and the `setter.set.*` proxy)
 * can be used regardless of whether the underlying mechanism is inline styles or stylesheet rules.
 *
 * ## Adapter contract (important invariants)
 * The adapters are called with:
 * - `propCanon`: a canonical CSS property string (kebab-case or `--custom-prop`).
 * - `value`: a rendered string value (already normalized/coerced by `renderStyleValue()`).
 *
 * Adapters should treat these as “ready to apply”:
 * - `apply(propCanon, value)` must perform the write for that backend.
 * - `remove(propCanon)` must delete/unset that property for that backend.
 * - `clear()` must remove all properties for that handle/backend target.
 *
 * `make_style_setter()` guarantees:
 * - `null | undefined` values are treated as **remove semantics** (calls `adapters.remove()`).
 * - keys passed via proxy or map entries are normalized via `normalize_css_prop_key()`.
 *
 * ## Proxy builder notes
 * The returned `setter.set` is a Proxy that converts property access into calls:
 *   `setter.set.backgroundColor("red")` → `setProp("backgroundColor", "red")`
 *   `setter.set["background-color"]("red")` → `setProp("background-color", "red")`
 *   `setter.set.var("--k", 1)` → `setProp("--k", 1)`
 *
 * @param adapters Backend callbacks that implement apply/remove/clear for a specific target
 * (inline style, QUID stylesheet block, etc.).
 *
 * @returns A fluent `StyleSetter` that delegates mutations to the provided adapters.
 */
export function make_style_setter(adapters: StyleSetterAdapters): StyleSetter {
  const keySet: ReadonlySet<string> | null =
    adapters.keys ? new Set(adapters.keys) : null;

  const setterApi: {
    setProp: (prop: CssKey, v: CssValue) => StyleSetter;
    setMany: (map: CssMap) => StyleSetter;
    remove: (prop: CssKey) => StyleSetter;
    clear: () => StyleSetter;
    set: any;
  } = {
    setProp(prop: CssKey, v: CssValue): StyleSetter {
      const canon = nrmlz_cssom_prop_key(prop);
      const rendered = renderStyleValue(v);

      //  null/undefined => remove (predictable “delete semantics”)
      if (rendered == null) {
        adapters.remove(canon);
        return api;
      }

      adapters.apply(canon, rendered);
      return api;
    },

    setMany(map: CssMap): StyleSetter {
      for (const [k, v] of Object.entries(map)) {
        if (v) { setterApi.setProp(k, v); }
      }
      return api;
    },

    remove(prop: CssKey): StyleSetter {
      adapters.remove(nrmlz_cssom_prop_key(prop));
      return api;
    },

    clear(): StyleSetter {
      adapters.clear();
      return api;
    },

    set: null as any,
  };

  // Proxy builder:
  //   setter.set.backgroundColor("x")
  //   setter.set["background-color"]("x")  (allowed)
  //   setter.set.var("--bg", "#123")
  const setProxy = new Proxy({} as StyleSetter["set"], {
    get(_t, rawKey: string | symbol) {
      if (rawKey === "var") {
        return (name: `--${string}`, v: CssValue) => setterApi.setProp(name, v);
      }
      if (typeof rawKey !== "string") return undefined;

      // runtime normalization still happens inside setProp()
      return (v: CssValue) => setterApi.setProp(rawKey, v);
    },
  });

  setterApi.set = setProxy;

  const api: StyleSetter = {
    set: setProxy as StyleSetter["set"],
    setProp: setterApi.setProp,
    setMany: setterApi.setMany,
    remove: setterApi.remove,
    clear: setterApi.clear,
  };

  return api;
}

/* ----------------------------- normalization ----------------------------- */

/**
 * Coerce a `StyleValue` into a CSS-ready string, or return `null` to signal “remove”.
 *
 * Semantics:
 * - `null | undefined` → `null` (meaning: remove the property)
 * - `string` → trimmed string (empty string is allowed and preserved)
 * - `number | boolean` → stringified
 * - `{ value, unit? }` → `${value}${unit ?? ""}` (trimmed)
 *
 * This function is the *only* place where `StyleValue` coercion rules should live, so that:
 * - `StyleManager` and `CssManager` backends behave identically, and
 * - tests can target one normalization surface rather than multiple call-sites.
 */
function renderStyleValue(v: CssValue): string | null {
  if (v == null) return null;

  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? "" : s;
  }

  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") {
    const obj = v as { value?: unknown; unit?: unknown };

    if ("value" in obj) {
      const raw = obj.value;
      const unit = typeof obj.unit === "string" ? obj.unit : "";
      const val =
        typeof raw === "string" ? raw.trim() :
          typeof raw === "number" ? String(raw) :
            raw == null ? "" :
              String(raw);

      return `${val}${unit}`.trim();
    }

    //  fallback so weird objects don't stringify to "[object Object]"
    return String(v);
  }
  return String(v);
}
