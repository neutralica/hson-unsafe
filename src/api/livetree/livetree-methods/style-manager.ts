// style-manager.ts

/**
 * StyleManager
 * ------------
 * A LiveTree-scoped helper for manipulating inline styles on the current
 * selection.
 *
 * Responsibilities:
 *   - normalize property names (camelCase → kebab-case, except CSS variables)
 *   - apply inline styles to all selected nodes
 *   - read back values from the first selected node
 *   - provide batch operations with merge (`css`) or replace (`cssReplace`)
 *   - expose a typed `set` facade built from runtime-supported style keys
 *
 * All methods:
 *   - operate on the LiveTree's current selection,
 *   - update the underlying HSON node attributes,
 *   - and sync to the DOM when the nodes are mounted.
 */

import { HsonAttrs, HsonNode } from "../../../types-consts/node.types";
import { StyleObject } from "../../../types-consts/css.types";
import { camel_to_kebab, serialize_style } from "../../../utils/attrs-utils/serialize-style";
import { kebab_to_camel } from "../../../utils/primitive-utils/kebab-to-camel.util";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers";
import { LiveTree } from "../livetree";
import { make_style_setter, StyleSetter } from "./style-setter";

/* ------------------------------- TYPE HELPERS ------------------------------- */
/**
 * Extract only the string-valued keys from a type.
 *
 * For `CSSStyleDeclaration`, this filters out non-string keys so that
 * downstream helpers can reason purely in terms of string property
 * names.
 *
 * @typeParam T - The object type whose keys should be filtered.
 */
type StringKeys<T> = Extract<keyof T, string>;
/**
 * Extract keys from `T` whose values are assignable to `string`.
 *
 * Used with `CSSStyleDeclaration` to discover which properties are
 * string fields (e.g. `color`, `backgroundColor`) and thus suitable
 * for use as style keys.
 *
 * @typeParam T - The object type whose string-valued keys are desired.
 */
type KeysWithStringValues<T> = {
    [K in StringKeys<T>]: T[K] extends string ? K : never
}[StringKeys<T>];

/**
 * Subset of `CSSStyleDeclaration` keys that:
 * - are strings, and
 * - have `string` values,
 * excluding the special `cssText` field.
 *
 * These keys represent the canonical style properties supported by
 * the current browser and form the base of `StyleKey` and the
 * `StyleSetterFacade` surface.
 */
export type AllowedStyleKey = Exclude<KeysWithStringValues<CSSStyleDeclaration>, "cssText">;

/**
 * Union of all style keys supported by the style system:
 * - `AllowedStyleKey` — canonical properties from `CSSStyleDeclaration`.
 * - `--${string}` — arbitrary CSS custom properties (variables).
 * - `${string}-${string}` — kebab-case custom or unknown properties.
 *
 * This allows both strongly-typed known properties and flexible
 * custom/kebab names to be handled by the same infrastructure.
 */
export type StyleKey =
    | string
// | AllowedStyleKey
// | `--${string}`          // CSS variables
// | `${string}-${string}`; // kebab custom/unknown


/* ------------------------------ RUNTIME KEYS -------------------------------- */

/**
 * Minimal fallback list of allowed style keys used when no DOM is present
 * (e.g. tests, server-side/Node environments).
 *
 * This list is intentionally small and generic but covers common layout,
 * typography, and transform properties so that style APIs remain usable
 * even without runtime probing.
 */
// TODO -- I am not sure I like this pattern
const FALLBACK_KEYS: ReadonlyArray<AllowedStyleKey> = Object.freeze([
    "color",
    "backgroundColor",
    "borderColor",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "opacity",
    "display",
    "position",
    "top",
    "left",
    "right",
    "bottom",
    "width",
    "height",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "transform",
]);

/**
 * Remove a single inline style declaration from a node and its DOM element.
 *
 * Behavior:
 * - Normalizes the internal key:
 *   - Custom properties (`--*`) are kept verbatim.
 *   - Normal properties are converted from kebab-case to camelCase to
 *     match the HSON style object shape.
 * - Updates the HSON model:
 *   - Deletes the property from `_attrs.style`.
 *   - Removes `_attrs.style` entirely if it becomes empty.
 * - Updates the DOM:
 *   - If an associated `HTMLElement` exists, calls
 *     `el.style.removeProperty(kebabName)`.
 *
 * @param node - The HSON node whose style should be updated.
 * @param kebabName - The CSS property name in kebab-case (or `--var` form).
 */
function removeStyleFromNode(node: HsonNode, kebabName: string): void {
    // 1) Normalize internal key (HSON uses camelCase for normal props, verbatim for custom)
    const internalKey =
        kebabName.startsWith("--")
            ? kebabName
            : kebab_to_camel(kebabName); // you already have this alongside camel_to_kebab

    // 2) Update node model (_attrs.style is CssObject now)
    const attrs = (node as any)._attrs as HsonAttrs | undefined;
    const styleObj = (attrs?.style as StyleObject | undefined) ?? undefined;

    if (styleObj) {
        // drop from CssObject
        delete (styleObj as any)[internalKey];

        // if now empty, remove style entirely
        if (!Object.keys(styleObj).length) {
            if (attrs) {
                delete (attrs as any).style;
            }
        } else {
            if (attrs) {
                (attrs as any).style = styleObj;
            }
        }
    }

    // 3) Update DOM
    const el = element_for_node(node) as HTMLElement | undefined;
    if (!el) return;

    // Use DOM’s own removeProperty for the kebab name
    el.style.removeProperty(kebabName);
}

/**
 * Probe the runtime to discover supported style property keys.
 *
 * Behavior:
 * - If `document` or `document.documentElement` is unavailable, returns
 *   `FALLBACK_KEYS` (Node/tests).
 * - Otherwise:
 *   - Reads keys from `document.documentElement.style`.
 *   - Filters out `"cssText"` and any keys containing `"-"` (i.e. only
 *     keeps canonical camelCase properties).
 *   - Deduplicates and freezes the resulting array.
 *
 * The returned array is used to:
 * - Drive autocomplete and typing for `style.set` via `AllowedStyleKey`.
 * - Build the `StyleSetterFacade` proxy in a runtime-aware way.
 *
 * @returns A readonly array of allowed style keys for this runtime.
 */
function computeRuntimeKeys(): ReadonlyArray<AllowedStyleKey> {
    if (typeof document === "undefined" || !document.documentElement) {
        return FALLBACK_KEYS;
    }
    const style = document.documentElement.style;
    const raw = Object.keys(style as unknown as Record<string, unknown>);
    const filtered = raw.filter((k) => k !== "cssText" && !k.includes("-"));
    const typed = filtered.filter((k): k is AllowedStyleKey => true);
    return Object.freeze(Array.from(new Set(typed)));
}

/* --------------------------------- HELPERS ---------------------------------- */


/**
 * Normalize `node._attrs.style` to an object map of kebab keys to values.
 *
 * Behavior:
 * - If `a.style` is a string:
 *   - Parses it as CSS text (`"foo: bar; baz: qux"`).
 *   - Produces a `Record<string, string>` with trimmed keys and values.
 *   - Stores the object back into `a.style`.
 * - If `a.style` is already an object:
 *   - Returns it as `Record<string, string>`.
 * - If `a.style` is missing or falsy:
 *   - Creates a fresh object, assigns it to `a.style`, and returns it.
 *
 * This function provides a single normalization point so that the rest
 * of the style system can assume `_attrs.style` is an object.
 *
 * @param a - Attribute bag (typically `node._attrs`) to normalize.
 * @returns A mutable style object with kebab property keys.
 */
function ensureStyleObject(a: Record<string, unknown>): Record<string, string> {
    // prefer object going forward; upgrade string-once if present.
    const prev = a.style;
    if (typeof prev === "string") {
        const out: Record<string, string> = Object.create(null);
        const text = prev.trim();
        if (text) {
            for (const seg of text.split(";")) {
                const s = seg.trim();
                if (!s) continue;
                const idx = s.indexOf(":");
                if (idx <= 0) continue;
                const k = s.slice(0, idx).trim();
                const v = s.slice(idx + 1).trim();
                if (k) {
                    const storeKey = k.startsWith("--") ? k : kebab_to_camel(k);
                    out[storeKey] = v;
                }
            }
        }
        a.style = out;
        return out;
    }
    if (prev && typeof prev === "object") {
        const obj = prev as Record<string, string>;
        // normalize any kebab keys to camelCase once on read
        const needsNormalize = Object.keys(obj).some(k => k.includes("-"));
        if (!needsNormalize) return obj;

        const normalized: Record<string, string> = Object.create(null);
        for (const [k, v] of Object.entries(obj)) {
            const storeKey = k.startsWith("--") ? k : kebab_to_camel(k);
            normalized[storeKey] = v;
        }
        a.style = normalized;
        return normalized;
    }
    const fresh: Record<string, string> = Object.create(null);
    a.style = fresh;
    return fresh;
}

/**
 * Write a single style property to both DOM and HSON for a node.
 *
 * Behavior:
 * 1. DOM:
 *    - If an `HTMLElement` is mapped for the node:
 *      - `value === ""` → `el.style.removeProperty(kebabName)`.
 *      - Otherwise → `el.style.setProperty(kebabName, value)`.
 * 2. HSON:
 *    - Ensures `_attrs` exists and normalizes `_attrs.style` to an object
 *      via `ensureStyleObject`.
 *    - `value === ""`:
 *        - Deletes the key from the style object if present.
 *    - Otherwise:
 *        - Sets `styleObj[kebabName] = value`.
 *
 * This keeps the in-memory HSON representation and the live DOM
 * element in sync for the given property.
 *
 * @param node - The HSON node to update.
 * @param kebabName - CSS property name in kebab-case (or `--var` form).
 * @param value - The string value to assign; empty string removes the property.
 * @see ensureStyleObject
 */
function applyStyleToNode(node: HsonNode, kebabName: string, value: string): void {
    // 1) push to DOM if element exists
    const el = element_for_node(node);
    if (el instanceof HTMLElement) {
        if (value === "") {
            el.style.removeProperty(kebabName);
        } else {
            el.style.setProperty(kebabName, value);
        }
    }

    // 2) mirror into node._attrs.style (object form)
    const attrs = (node._attrs ??= {}) as Record<string, unknown>;
    const styleObj = ensureStyleObject(attrs);
    const internalKey = kebabName.startsWith("--") ? kebabName : kebab_to_camel(kebabName);
    if (value === "") {
        if (Object.prototype.hasOwnProperty.call(styleObj, internalKey)) {
            delete styleObj[internalKey];
        }
    } else {
        styleObj[internalKey] = value;
    }
}

// /**
//  * Read a single style property value for a node, preferring the DOM.
//  *
//  * Behavior:
//  * - If an `HTMLElement` is mapped for the node:
//  *   - Calls `getComputedStyle(el).getPropertyValue(kebabName)`.
//  *   - Trims the result; if non-empty, returns it.
//  * - Otherwise (or if DOM value is empty):
//  *   - Looks at `node._attrs.style`:
//  *     - If it's a string, parses it with a small regex to find the
//  *       requested property.
//  *     - If it's an object, returns `styleObj[kebabName]` if present
//  *       and non-empty.
//  *
//  * Returns `undefined` when no value can be determined from either DOM
//  * or HSON.
//  *
//  * @param node - The HSON node whose style should be inspected.
//  * @param kebabName - CSS property name in kebab-case (or `--var` form).
//  * @returns The effective style value as a string, or `undefined` if absent.
//  */
// function readStyleFromNode(node: HsonNode, kebabName: string): string | undefined {
//     const el = element_for_node(node);
//     if (el instanceof HTMLElement) {
//         const v = getComputedStyle(el).getPropertyValue(kebabName);
//         const t = v.trim();
//         if (t !== "") return t;
//     }
//     const a = node._attrs as Record<string, unknown> | undefined;
//     if (!a) return undefined;
//     const s = a.style;
//     if (!s) return undefined;
//     if (typeof s === "string") {
//         const m = s.match(new RegExp(`(^|;)\\s*${kebabName}\\s*:\\s*([^;]+)`));
//         return m?.[2]?.trim();
//     }
//     if (typeof s === "object") {
//         const obj = s as Record<string, string>;
//         const v = obj[kebabName];
//         return v === "" ? undefined : v;
//     }
//     return undefined;
// }

// /* --------------------------- FACADE (Proxy-based) --------------------------- */
// /**
//  * Proxy-backed facade for strongly-typed style setters.
//  *
//  * Structure:
//  * - For each `AllowedStyleKey`:
//  *   - Exposes a method `(value: string) => LiveTree`, enabling calls
//  *     such as `tree.style.set.width("240px")`.
//  * - Index signature:
//  *   - `[custom: string]: (value: string) => LiveTree` allows bracket
//  *     access for kebab/custom names:
//  *     - `tree.style.set["--brand-color"]("#f0f")`
//  *     - `tree.style.set["background-color"]("red")`
//  *
//  * Implementations returned by `buildSetFacade`:
//  * - Normalize property names (camelCase vs kebab/custom).
//  * - Delegate to `applyStyleToNode` and return the underlying `LiveTree`
//  *   for chaining.
//  */
// type StyleSetterFacade = {
//     // typed camelCase keys → setter(value: string)
//     [K in AllowedStyleKey]: (value: string) => LiveTree;
// } & {
//     // bracket access allows kebab/custom ('--brand', 'background-color')
//     [custom: string]: (value: string) => LiveTree;
// };

// /**
//  * Build a `StyleSetterFacade` for a given `LiveTree` and key set.
//  *
//  * Behavior:
//  * - Creates a Proxy whose:
//  *   - `get` trap:
//  *     - For a known key:
//  *       - Returns a cached setter function `(value: string) => LiveTree`
//  *         that:
//  *           - Normalizes the property name (camelCase → kebab unless
//  *             already `--` or containing `"-"`).
//  *           - Writes to the node via `applyStyleToNode`.
//  *           - Returns the same `LiveTree` for chaining.
//  *     - For unknown keys:
//  *       - Attempts a camelCase lookup via `kebab_to_camel`.
//  *       - Falls back to treating the key as-is (custom/kebab path).
//  *   - `ownKeys` / `getOwnPropertyDescriptor` / `has` traps:
//  *       - Expose the runtime `keys` set for reflection and tooling.
//  *   - `set` trap:
//  *       - Disallows assigning new properties directly to the facade.
//  *
//  * The facade is built once per `StyleManager2` instance and reused for
//  * all `style.set.*` calls on that tree.
//  *
//  * @param tree - The `LiveTree` whose node styles the facade will mutate.
//  * @param keys - The runtime-derived style keys (`AllowedStyleKey[]`) to
//  *               expose as strongly-typed properties.
//  * @returns A `StyleSetterFacade` proxy bound to the given tree.
//  * @see applyStyleToNode
//  * @see kebab_to_camel
//  * @see camel_to_kebab
//  */
// function buildSetFacade(tree: LiveTree, keys: ReadonlyArray<AllowedStyleKey>): StyleSetterFacade {
//     const target: Record<string | symbol, unknown> = Object.create(null);
//     const cache = new Map<string, (value: string) => LiveTree>();

//     const hasKey: Record<string, true> = Object.create(null);
//     for (let i = 0; i < keys.length; i += 1) hasKey[keys[i]] = true;

//     const ensureSetter = (name: string): ((value: string) => LiveTree) => {
//         const hit = cache.get(name);
//         if (hit) return hit;

//         const setter = (value: string): LiveTree => {
//             // write across all currently selected nodes
//             const kebab = name.startsWith("--") || name.includes("-") ? name : camel_to_kebab(name);
//             const val = value; // keep raw; empty string removes property
//             applyStyleToNode(tree.node, kebab, val);
//             return tree;
//         };

//         cache.set(name, setter);
//         return setter;
//     };

//     const handler: ProxyHandler<typeof target> = {
//         get(_t, prop) {
//             if (typeof prop !== "string") return undefined;
//             if (hasKey[prop] === true) return ensureSetter(prop);
//             const maybeCamel = kebab_to_camel(prop);
//             if (maybeCamel !== prop && hasKey[maybeCamel] === true) {
//                 return ensureSetter(maybeCamel);
//             }
//             return ensureSetter(prop); // generic path (kebab/custom)
//         },
//         ownKeys() {
//             return keys.slice(); // mutable copy as required by Proxy contract
//         },
//         getOwnPropertyDescriptor(_t, prop) {
//             if (typeof prop !== "string") return undefined;
//             if (hasKey[prop] !== true) return undefined;
//             return {
//                 configurable: true,
//                 enumerable: true,
//                 writable: false,
//                 value: ensureSetter(prop),
//             };
//         },
//         has(_t, prop) {
//             return typeof prop === "string" && hasKey[prop] === true;
//         },
//         set() {
//             return false;
//         },
//     };

//     return new Proxy(target, handler) as unknown as StyleSetterFacade;
// }

/* --------------------------------- MANAGER ---------------------------------- */
/**
 * Inline style manager bound to a single `LiveTree` node.
 *
 * Responsibilities:
 * - Provides a typed, DX-friendly facade over inline styles via `set`
 *   and `setProperty`.
 * - Keeps HSON `_attrs.style` and the DOM element's `style` attribute
 *   in sync through helpers such as `applyStyleToNode` and
 *   `removeStyleFromNode`.
 * - Exposes runtime-derived style keys (via `keys()`) that represent
 *   the actual properties supported in the current environment.
 *
 * This manager is per-node: each `StyleManager` instance operates on
 * the `LiveTree` it was constructed with, not on selections.
 */
export class StyleManager {
    // accept the real LiveTree2; do not reference private methods.
    private readonly tree: LiveTree;
    private readonly runtimeKeys: ReadonlyArray<AllowedStyleKey>;
    // private readonly _set: StyleSetterFacade;
    public readonly setter: StyleSetter;

    /**
     * Create a `StyleManager2` for a given `LiveTree`.
     *
     * Implementation details:
     * - Stores the `LiveTree` instance for all subsequent style operations.
     * - Computes `runtimeKeys` once via `computeRuntimeKeys()`, probing the
     *   runtime for supported style properties.
     * - Builds `_set` via `buildSetFacade(tree, runtimeKeys)`, producing a
     *   property-based setter surface (e.g. `style.set.width(240)`).
     *
     * @param tree - The `LiveTree` whose node (and mapped DOM element) will
     *               be styled by this manager.
     * @see computeRuntimeKeys
     * @see buildSetFacade
     */
    constructor(tree: LiveTree) {
        this.tree = tree;
        // compute keys once (DOM probe if available).
        this.runtimeKeys = computeRuntimeKeys();
        // build the proxy using those keys.
        // this._set = buildSetFacade(this.tree, this.runtimeKeys);
        this.setter = make_style_setter({
            // OPTIONAL: if you have runtimeKeys in camelCase, feed them
            keys: this.runtimeKeys,

            apply: (propCanon, value) => {
                // assumes setProperty accepts canonical camelCase or --var
                this.apply(propCanon, value);
            },

            remove: (propCanon) => {
                this.remove(propCanon);
            },

            clear: () => {
                this.clearAll();
            },
        });
    }

    // /**
    //  * Typed style setter facade for this node.
    //  *
    //  * Examples:
    //  *   `tree.style.set.width(240);`
    //  *   `tree.style.set.transform("translate(10px, 20px)");`
    //  *
    //  * This is a DX layer over `setProperty`, where:
    //  * - Keys are constrained to the runtime-supported style properties
    //  *   discovered at initialization (`runtimeKeys`).
    //  * - Values are passed through to the underlying single-property logic.
    //  *
    //  * @returns A `StyleSetterFacade` exposing property-specific setter methods.
    //  */
    // private get set(): StyleSetterFacade {
    //     return this._set;
    // }

    /**
     * Set a single inline style property on this node.
     *
     * Behavior:
     * - Accepts property names in camelCase or kebab-case.
     *   - CamelCase names are normalized to kebab-case via `camel_to_kebab`,
     *     except for custom properties starting with `--`, which are left
     *     as-is.
     * - `value`:
     *   - `null` or `undefined` → treated as `""` and removes the declaration.
     *   - string/number → converted to string and applied as-is (units are
     *     the caller's responsibility).
     * - Delegates to `applyStyleToNode`, which updates both the HSON node
     *   and the corresponding DOM element.
     *
     * @param propertyName - CSS property name in camelCase or kebab-case.
     * @param value - New value for the property, or `null` to remove it.
     * @returns The underlying `LiveTree` instance, for chaining.
     * @see applyStyleToNode
     */
    private apply(propertyName: string, value: string | number | null): LiveTree {
        const kebab = propertyName.startsWith("--")
            ? propertyName
            : camel_to_kebab(propertyName);

        const val = value == null ? "" : String(value);
        applyStyleToNode(this.tree.node, kebab, val);

        return this.tree;
    }
    // /**
    //  * Read a style property value from this node's inline style.
    //  *
    //  * Behavior:
    //  * - Uses `this.tree.node` as the single source node.
    //  * - Normalizes the requested property name before lookup.
    //  * - Delegates to `readStyleFromNode`, which inspects the HSON-backed
    //  *   style representation (and/or inline style attribute, depending on
    //  *   implementation).
    //  *
    //  * @param propertyName - CSS property name in camelCase or kebab-case.
    //  * @returns The property value as a string, or `undefined` if there is no
    //  *          inline declaration for that property.
    //  * @see readStyleFromNode
    //  */
    // private get(propertyName: string): string | undefined {
    //     const first = this.tree.node;
    //     if (!first) return undefined;
    //     const kebab = kebab_to_camel(propertyName);
    //     return readStyleFromNode(first, kebab);
    // }

    /**
     * Remove a single inline style property from this node.
     *
     * Behavior:
     * - Normalizes the property name from camelCase to kebab-case (except
     *   for `--custom` variables).
     * - Delegates to `removeStyleFromNode`, which clears the property from
     *   the node's style object and the DOM `style` attribute.
     *
     * This is equivalent to calling `setProperty(propertyName, null)` but
     * uses the dedicated removal pathway.
     *
     * @param propertyName - CSS property name in camelCase or kebab-case.
     * @returns The underlying `LiveTree` instance, for chaining.
     * @see removeStyleFromNode
     */
    private remove(propertyName: string): LiveTree {
        const kebab = camel_to_kebab(propertyName);
        const node = this.tree.node;
        removeStyleFromNode(node, kebab);

        return this.tree;
    }

    // /**
    //  * Return the list of allowed style keys for this runtime.
    //  *
    //  * The returned array is the same `runtimeKeys` computed at construction
    //  * time, representing the style properties that `style.set` can expose.
    //  *
    //  * Useful for:
    //  * - Testing and assertions.
    //  * - Tooling that wants to inspect what properties are supported.
    //  * - Diagnostics and introspection.
    //  *
    //  * @returns A readonly array of runtime-supported style property keys.
    //  */
    // private keys(): ReadonlyArray<AllowedStyleKey> {
    //     return this.runtimeKeys;
    // }

    // /**
    //  * Batch inline-style setter with merge semantics.
    //  *
    //  * Example:
    //  *   tree.style.setMulti({
    //  *     width: 240,
    //  *     transform: "translate(10px, 20px)",
    //  *     "--win-bg": "#111",
    //  *   });
    //  *
    //  * Rules:
    //  * - Iterates over the own keys of `props`:
    //  *   - `undefined` → ignored (no-op for that key).
    //  *   - `null` → removes the property via `remove(propertyName)`.
    //  *   - string/number → applied via `setProperty(propertyName, value)`.
    //  * - Only the properties present in `props` are touched; all other
    //  *   existing declarations on the node are left intact (merge, not replace).
    //  *
    //  * @param props - Map of property names to values to merge into the
    //  *                existing inline style.
    //  * @returns The underlying `LiveTree` instance, for chaining.
    //  * @see setProperty
    //  * @see remove
    //  */
    // private setMulti(props: StyleObject): LiveTree {
    //     // snapshot keys once; iteration order preserved
    //     const keys = Object.keys(props) as Array<keyof StyleObject>;
    //     for (let i = 0; i < keys.length; i += 1) {
    //         const k = keys[i];
    //         const v = props[k];
    //         if (v === undefined) continue;        // skip holes
    //         if (v === null) {
    //             // allow null to mean "remove this declaration"
    //             this.remove(String(k));
    //         } else {
    //             // delegate to existing single-prop pathway
    //             this.setProperty(String(k), v);
    //         }
    //     }
    //     return this.tree;
    // }

    private clearAll(): void {
        const node = this.tree.node;
        if (!node._attrs) return;

        const attrs = node._attrs as HsonAttrs;
        delete (attrs as any).style;

        const el = element_for_node(node) as HTMLElement | undefined;
        if (el) el.removeAttribute("style");
    }

}
