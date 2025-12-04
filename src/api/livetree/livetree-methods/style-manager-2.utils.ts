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
import { camel_to_kebab, serialize_style } from "../../../utils/attrs-utils/serialize-css.utils";
import { kebab_to_camel } from "../../../utils/primitive-utils/kebab-to-camel.util";
import { getElementForNode } from "../../../utils/tree-utils/node-map-helpers.utils";
import { LiveTree } from "../live-tree-class.new.tree";

/* ------------------------------- TYPE HELPERS ------------------------------- */
// comment: Derive style keys from CSSStyleDeclaration (type-level autocomplete).
type StringKeys<T> = Extract<keyof T, string>;
type KeysWithStringValues<T> = {
    [K in StringKeys<T>]: T[K] extends string ? K : never
}[StringKeys<T>];
type AllowedStyleKey = Exclude<KeysWithStringValues<CSSStyleDeclaration>, "cssText">;
type StyleKey =
    | AllowedStyleKey
    | `--${string}`          // CSS variables
    | `${string}-${string}`; // kebab custom/unknown
export type StyleObject = Partial<Record<StyleKey, string | number | null | undefined>>;

/* ------------------------------ RUNTIME KEYS -------------------------------- */
// comment: Minimal fallback list used when no DOM is present (tests, Node).
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
    const el = getElementForNode(node) as HTMLElement | undefined;
    if (!el) return;

    // Use DOM’s own removeProperty for the kebab name
    el.style.removeProperty(kebabName);
}

/* Probe <html>.style once to get the browser’s canonical keys. */
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


// comment: Normalize style storage on node._attrs.style to an object (kebab keys).
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
                if (k) out[k] = v;
            }
        }
        a.style = out;
        return out;
    }
    if (prev && typeof prev === "object") {
        return prev as Record<string, string>;
    }
    const fresh: Record<string, string> = Object.create(null);
    a.style = fresh;
    return fresh;
}

// comment: Write a single property (kebab) to DOM + node attrs.
function applyStyleToNode(node: HsonNode, kebabName: string, value: string): void {
    // 1) push to DOM if element exists
    const el = getElementForNode(node);
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
    if (value === "") {
        if (Object.prototype.hasOwnProperty.call(styleObj, kebabName)) {
            delete styleObj[kebabName];
        }
    } else {
        styleObj[kebabName] = value;
    }
}

// Read a single property (kebab) from DOM (preferred) or node attrs.
function readStyleFromNode(node: HsonNode, kebabName: string): string | undefined {
    const el = getElementForNode(node);
    if (el instanceof HTMLElement) {
        const v = getComputedStyle(el).getPropertyValue(kebabName);
        const t = v.trim();
        if (t !== "") return t;
    }
    const a = node._attrs as Record<string, unknown> | undefined;
    if (!a) return undefined;
    const s = a.style;
    if (!s) return undefined;
    if (typeof s === "string") {
        const m = s.match(new RegExp(`(^|;)\\s*${kebabName}\\s*:\\s*([^;]+)`));
        return m?.[2]?.trim();
    }
    if (typeof s === "object") {
        const obj = s as Record<string, string>;
        const v = obj[kebabName];
        return v === "" ? undefined : v;
    }
    return undefined;
}

/* --------------------------- FACADE (Proxy-based) --------------------------- */
type StyleSetterFacade = {
    // typed camelCase keys → setter(value: string)
    [K in AllowedStyleKey]: (value: string) => LiveTree;
} & {
    // bracket access allows kebab/custom ('--brand', 'background-color')
    [custom: string]: (value: string) => LiveTree;
};

// comment: Build the proxy once per manager using a stable key list.
function buildSetFacade(tree: LiveTree, keys: ReadonlyArray<AllowedStyleKey>): StyleSetterFacade {
    const target: Record<string | symbol, unknown> = Object.create(null);
    const cache = new Map<string, (value: string) => LiveTree>();

    const hasKey: Record<string, true> = Object.create(null);
    for (let i = 0; i < keys.length; i += 1) hasKey[keys[i]] = true;

    const ensureSetter = (name: string): ((value: string) => LiveTree) => {
        const hit = cache.get(name);
        if (hit) return hit;

        const setter = (value: string): LiveTree => {
            // write across all currently selected nodes
            const nodes = tree.getSelectedNodes();
            const kebab = name.startsWith("--") || name.includes("-") ? name : camel_to_kebab(name);
            const val = value; // keep raw; empty string removes property
            for (let i = 0; i < nodes.length; i += 1) {
                applyStyleToNode(nodes[i], kebab, val);
            }
            return tree;
        };

        cache.set(name, setter);
        return setter;
    };

    const handler: ProxyHandler<typeof target> = {
        get(_t, prop) {
            if (typeof prop !== "string") return undefined;
            if (hasKey[prop] === true) return ensureSetter(prop);
            const maybeCamel = kebab_to_camel(prop);
            if (maybeCamel !== prop && hasKey[maybeCamel] === true) {
                return ensureSetter(maybeCamel);
            }
            return ensureSetter(prop); // generic path (kebab/custom)
        },
        ownKeys() {
            return keys.slice(); // mutable copy as required by Proxy contract
        },
        getOwnPropertyDescriptor(_t, prop) {
            if (typeof prop !== "string") return undefined;
            if (hasKey[prop] !== true) return undefined;
            return {
                configurable: true,
                enumerable: true,
                writable: false,
                value: ensureSetter(prop),
            };
        },
        has(_t, prop) {
            return typeof prop === "string" && hasKey[prop] === true;
        },
        set() {
            return false;
        },
    };

    return new Proxy(target, handler) as unknown as StyleSetterFacade;
}

/* --------------------------------- MANAGER ---------------------------------- */
export class StyleManager {
    // accept the real LiveTree; do not reference private methods.
    private readonly tree: LiveTree;
    private readonly runtimeKeys: ReadonlyArray<AllowedStyleKey>;
    private readonly _set: StyleSetterFacade;

    /**
     * Creates a StyleManager for a given LiveTree.
     * @param tree - The LiveTree whose selection and DOM mapping will be used.
     * Implementation notes:
     *   - `runtimeKeys` is computed once (via `computeRuntimeKeys()`) to
     *     reflect the actual style properties supported in this runtime.
     *   - `_set` is a facade that exposes property-specific setters
     *     (e.g. `style.set.width(240)`), built from those keys.
     */
    constructor(tree: LiveTree) {
        this.tree = tree;
        // compute keys once (DOM probe if available).
        this.runtimeKeys = computeRuntimeKeys();
        // build the proxy using those keys.
        this._set = buildSetFacade(this.tree, this.runtimeKeys);
    }

    /**
      * Typed style setter facade.
      *
      * Example:
      *   `tree.style.set.width(240)`
      *   `tree.style.set.transform('translate(10px, 20px)')`
      *
      * This is primarily a DX layer over `setProperty`, with keys constrained
      * to the runtime-supported style properties discovered at initialization.
      */
    get set(): StyleSetterFacade {
        return this._set;
    }

    /**
     * Sets a single inline style property on all selected nodes.
     *
     * @param propertyName - CSS property name in camelCase or kebab-case.
     *   CamelCase names are normalized to kebab-case (except `--custom` vars).
     * @param value - New value for the property. `null` or `""` remove the
     *   declaration.
     *
     * Behavior:
     *   - Normalizes the property name via `camelToKebab`.
     *   - Converts `null` to empty string for removal.
     *   - Delegates to `applyStyleToNode` for each selected node, which
     *     updates both IR and DOM.
     *
     * Returns the original LiveTree to allow chaining.
     */
    setProperty(propertyName: string, value: string | number | null): LiveTree {
        const kebab = propertyName.startsWith("--")
            ? propertyName
            : camel_to_kebab(propertyName);

        const val = value == null ? "" : String(value);
        const nodes = this.tree.getSelectedNodes();
        for (let i = 0; i < nodes.length; i += 1) {
            applyStyleToNode(nodes[i], kebab, val);
        }
        return this.tree;
    }
    /**
       * Reads a style property value from the first selected node.
       *
       * @param propertyName - CSS property name in camelCase or kebab-case.
       * @returns The string value of the property, or `undefined` if there is
       *   no selection or no inline declaration for that property.
       *
       * Notes:
       *   - Only inspects the first selected node.
       *   - Uses `readStyleFromNode`, which may reflect either IR or computed
       *     inline style depending on implementation.
       */
    get(propertyName: string): string | undefined {
        const nodes = this.tree.getSelectedNodes();
        const first = nodes[0];
        if (!first) return undefined;
        const kebab = kebab_to_camel(propertyName);
        return readStyleFromNode(first, kebab);
    }

    /**
     * Removes an inline style property from all selected nodes.
     *
     * @param propertyName - CSS property name in camelCase or kebab-case.
     * @returns The underlying LiveTree.
     *
     * This is equivalent to `setProperty(propertyName, "")`.
     */

    remove(propertyName: string): LiveTree {
        const kebab = camel_to_kebab(propertyName);
        const nodes = this.tree.getSelectedNodes();
        for (let i = 0; i < nodes.length; i += 1) {
            removeStyleFromNode(nodes[i], kebab);
        }
        return this.tree;
    }

    /**
     * Returns the list of allowed style keys for this runtime.
     *
     * @returns A readonly array of allowed style property keys.
     *
     * Mainly useful for:
     *   - testing,
     *   - introspection,
     *   - tooling that wants to know what `style.set` exposes.
     */
    keys(): ReadonlyArray<AllowedStyleKey> {
        return this.runtimeKeys;
    }

    /**
     * Batch inline-style setter with merge semantics.
     *
     * Example:
     *   tree.style.css({
     *     width: 240,
     *     transform: "translate(10px, 20px)",
     *     "--win-bg": "#111",
     *   });
     *
     * Rules:
     *   - Numbers are passed through as-is; units must be included by the caller.
     *   - `null` removes the property.
     *   - `undefined` is ignored (no-op for that key).
     *   - Only the provided keys are changed; existing other declarations are
     *     left intact (merge, not replace).
     *
     * @param props - Map of property names to values.
     * @returns The underlying LiveTree.
     */
    setObj(props: StyleObject): LiveTree {
        // snapshot keys once; iteration order preserved
        const keys = Object.keys(props) as Array<keyof StyleObject>;
        for (let i = 0; i < keys.length; i += 1) {
            const k = keys[i];
            const v = props[k];
            if (v === undefined) continue;        // skip holes
            if (v === null) {
                // allow null to mean "remove this declaration"
                this.remove(String(k));
            } else {
                // delegate to existing single-prop pathway
                this.setProperty(String(k), v);
            }
        }
        return this.tree;
    }

    /**
     * Batch inline-style setter with *replace* semantics.
     *
     * Example:
     *   tree.style.cssReplace({
     *     width: "240px",
     *     transform: "translate(10px,20px)",
     *     "--win-bg": "#111",
     *   });
     *
     * Behavior:
     *   1. Normalizes property names (camelCase → kebab-case, except `--vars`).
     *   2. For each selected node:
     *       - parses existing `style` attribute,
     *       - removes any inline declarations *not* present in `props`.
     *   3. Applies the provided declarations:
     *       - `null` removes a property,
     *       - `undefined` is ignored,
     *       - string/number values are set via `setProperty`.
     *
     * The result is that each selected node's inline style exactly matches
     * the keys in `props` (plus any properties explicitly removed via `null`).
     *
     * @param props - Map of property names to values to *replace* the existing
     *   inline style with.
     * @returns The underlying LiveTree.
     */

    replaceObj(map: StyleObject): LiveTree {
        // Normalize incoming map once → CssObject with only non-null, trimmed strings.
        const normalized: StyleObject = {};

        for (const key of Object.keys(map) as StyleKey[]) {
            const raw = map[key];
            if (raw == null) continue;

            const v = String(raw).trim();
            if (!v) continue;

            normalized[key] = v;
        }

        const normKeys = Object.keys(normalized) as StyleKey[];

        const nodes = this.tree.getSelectedNodes();
        for (const node of nodes) {
            if (!node._attrs) node._attrs = {};
            const attrs = node._attrs as HsonAttrs;
            const el = getElementForNode(node) as HTMLElement | undefined;

            // If replacement set is empty, drop style entirely.
            if (!normKeys.length) {
                delete (attrs as any).style;
                if (el) el.removeAttribute("style");
                continue;
            }

            // Build a fresh style object per node so they don't share references.
            const next: StyleObject = {};
            for (const key of normKeys) {
                const v = normalized[key];
                if (v == null) continue;
                next[key] = v;
            }

            (attrs as any).style = next;

            if (el) {
                // serialize_style already knows how to normalize keys/values;
                // at runtime this is just a string->string-ish record.
                const cssText = serialize_style(next as Record<string, string>);
                el.setAttribute("style", cssText);
            }
        }

        return this.tree;
    }

}
