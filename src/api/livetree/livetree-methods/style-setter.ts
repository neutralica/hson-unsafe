// style-setter.ts


import { normalize_css_prop_key } from "../../../utils/attrs-utils/normalize-css";
import { SetSurface } from "./css-manager";
import { StyleKey } from "./style-manager";


// keep this aligned with your existing CssValue if you already have it
export type StyleValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Readonly<{ value: string | number; unit?: string }>;

// canonical “many” map: camelCase keys at rest
export type StyleMap = Readonly<Partial<Record<StyleKey, StyleValue>>>;

export type StyleSetter = Readonly<{
  /** Proxy builder: setter.set.backgroundColor("aquamarine") */
  set: SetSurface<StyleSetter>;

  /** stringly escape hatch (accepts camelCase or kebab-case) */
  setProp: (prop: StyleKey, v: StyleValue) => StyleSetter;

  /** set many props from an object (keys may be camel or kebab) */
  setMany: (map: StyleMap) => StyleSetter;

  /** remove one prop (accepts camelCase or kebab-case) */
  remove: (prop: StyleKey) => StyleSetter;

  /** clear all props for this handle */
  clear: () => StyleSetter;
}>;

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

/** Create a StyleSetter backed by the provided adapters. */
export function make_style_setter(adapters: StyleSetterAdapters): StyleSetter {
  const keySet: ReadonlySet<string> | null =
    adapters.keys ? new Set(adapters.keys) : null;

  const setterApi: {
    setProp: (prop: StyleKey, v: StyleValue) => StyleSetter;
    setMany: (map: StyleMap) => StyleSetter;
    remove: (prop: StyleKey) => StyleSetter;
    clear: () => StyleSetter;
    set: any;
  } = {
    setProp(prop: StyleKey, v: StyleValue): StyleSetter {
      const canon = normalize_css_prop_key(prop);
      const rendered = renderStyleValue(v);

      // CHANGED: null/undefined => remove (predictable “delete semantics”)
      if (rendered == null) {
        adapters.remove(canon);
        return api;
      }

      adapters.apply(canon, rendered);
      return api;
    },

    setMany(map: StyleMap): StyleSetter {
      for (const [k, v] of Object.entries(map)) {
        setterApi.setProp(k, v);
      }
      return api;
    },

    remove(prop: StyleKey): StyleSetter {
      adapters.remove(normalize_css_prop_key(prop));
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
        return (name: `--${string}`, v: StyleValue) => setterApi.setProp(name, v);
      }
      if (typeof rawKey !== "string") return undefined;

      // runtime normalization still happens inside setProp()
      return (v: StyleValue) => setterApi.setProp(rawKey, v);
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

/** Render/coerce values to strings. Return null for “remove” semantics. */
function renderStyleValue(v: StyleValue): string | null {
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

    // CHANGED: fallback so weird objects don't stringify to "[object Object]"
    return String(v);
  }
    return String(v);
}
  
// old ending
//   // {value, unit} helper
//   const raw = v.value;
//   const unit = v.unit ?? "";
//   const val = typeof raw === "string" ? raw.trim() : String(raw);
//   return `${val}${unit}`.trim();
// }