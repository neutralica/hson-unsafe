/* =============================================================================
   StyleManager2 — drop-in, no LiveTreeLike, no SSR
   - Accepts the real LiveTree in constructor (no private withNodes usage)
   - Uses public liveTree.getSelectedNodes() (matches your current API)
   - Preserves ergonomic API: tree.style.set.color("blue"), set["--var"]("…")
   - Keeps classic methods for compatibility: set(name, val), get(name), remove(name)
   - Mirrors to DOM via NODE_ELEMENT_MAP when available, and to node._attrs.style (object)
   - No element stored on LiveTree; no SSR recorder; no runtime element reflection
   - Dynamic key list: probes document.documentElement.style once if DOM exists,
     else falls back to a small safe list. Types come from CSSStyleDeclaration.
   ========================================================================== */

/* ---------------------------------- IMPORTS --------------------------------- */
// comment: Pull in your project types. Adjust the import paths if needed.
import { NODE_ELEMENT_MAP } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.new.types";
import { lookup_element } from "../../../utils/lookup-element.html.utils";
import { LiveTree } from "../live-tree-class.new.tree";

/* ------------------------------- TYPE HELPERS ------------------------------- */
// comment: Derive style keys from CSSStyleDeclaration (type-level autocomplete).
type StringKeys<T> = Extract<keyof T, string>;
type KeysWithStringValues<T> = {
    [K in StringKeys<T>]: T[K] extends string ? K : never
}[StringKeys<T>];
type AllowedStyleKey = Exclude<KeysWithStringValues<CSSStyleDeclaration>, "cssText">;

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

// comment: Probe <html>.style once to get the browser’s canonical keys.
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
// comment: camelCase ↔ kebab-case conversion.
function camelToKebab(input: string): string {
    return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
function kebabToCamel(input: string): string {
    if (input.startsWith("--")) return input;
    if (!input.includes("-")) return input;
    const [head, ...rest] = input.split("-");
    return head + rest.map((p) => (p ? p[0].toUpperCase() + p.slice(1) : "")).join("");
}

// comment: Normalize style storage on node._attrs.style to an object (kebab keys).
function ensureStyleObject(a: Record<string, unknown>): Record<string, string> {
    // // CHANGED: prefer object going forward; upgrade string-once if present.
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
    const el = lookup_element(node);
    if (el instanceof HTMLElement) {
        if (value === "") {
            el.style.removeProperty(kebabName);
        } else {
            el.style.setProperty(kebabName, value);
        }
    }
    // const el = NODE_ELEMENT_MAP.get(node);
    // if (el && el instanceof HTMLElement) {
    //     if (value === "") {
    //         el.style.removeProperty(kebabName);
    //     } else {
    //         el.style.setProperty(kebabName, value);
    //     }
    // }

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

// comment: Read a single property (kebab) from DOM (preferred) or node attrs.
function readStyleFromNode(node: HsonNode, kebabName: string): string | undefined {
    const el = lookup_element(node);
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
    // // CHANGED: typed camelCase keys → setter(value: string)
    [K in AllowedStyleKey]: (value: string) => LiveTree;
} & {
    // // CHANGED: bracket access allows kebab/custom ('--brand', 'background-color')
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
            // // CHANGED: write across all currently selected nodes
            const nodes = tree.getSelectedNodes();
            const kebab = name.startsWith("--") || name.includes("-") ? name : camelToKebab(name);
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
            const maybeCamel = kebabToCamel(prop);
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
export class StyleManager2 {
    // // CHANGED: accept the real LiveTree; do not reference private methods.
    private readonly tree: LiveTree;
    private readonly runtimeKeys: ReadonlyArray<AllowedStyleKey>;
    private readonly _set: StyleSetterFacade;

    constructor(tree: LiveTree) {
        this.tree = tree;
        // // CHANGED: compute keys once (DOM probe if available).
        this.runtimeKeys = computeRuntimeKeys();
        // // CHANGED: build the proxy using those keys.
        this._set = buildSetFacade(this.tree, this.runtimeKeys);
    }
    get set(): StyleSetterFacade {
        return this._set;
    }

    // --- keep this (stringly migration path)
    setProperty(propertyName: string, value: string | number | null): LiveTree {
        const kebab = camelToKebab(propertyName);
        const val = value == null ? "" : String(value);
        const nodes = this.tree.getSelectedNodes();
        for (let i = 0; i < nodes.length; i += 1) {
            applyStyleToNode(nodes[i], kebab, val);
        }
        return this.tree;
    }

    // // CHANGED: read path mirrors your old get() logic.
    get(propertyName: string): string | undefined {
        const nodes = this.tree.getSelectedNodes();
        const first = nodes[0];
        if (!first) return undefined;
        const kebab = camelToKebab(propertyName);
        return readStyleFromNode(first, kebab);
    }

    // // CHANGED: remove maps to empty-string (CSS remove).
    remove(propertyName: string): LiveTree {
        return this.setProperty(propertyName, "");
    }

    // // CHANGED: expose the (frozen) key list for tests/inspection.
    keys(): ReadonlyArray<AllowedStyleKey> {
        return this.runtimeKeys;
    }
}
