// css-manager.utils.ts

import { CssProp, CssRule, CssRuleBuilder, CssText, CssValue } from "../../../types-consts/css-manager-types";




function renderCssValue(v: CssValue): string {
    if (typeof v === "string") {
        return v.trim();
    }
    const unit = v.unit === "_" ? "" : v.unit;
    return `${v.value}${unit}`;
}

//  singleton CSS manager that owns the global HSON stylesheet
export class CssManager {
    // singleton instance
    private static instance: CssManager | null = null;

    // in-memory registry of rules keyed by id
    private readonly rules: Map<string, CssText> = new Map();


    // cached <style> element, once resolved/created
    private styleEl: HTMLStyleElement | null = null;

    // use CssManager.invoke() instead of `new`
    private constructor() { }

    //  access the singleton instance
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

        // find or create the host <hson-_style> container
        let host = doc.querySelector("hson-_style#css-manager") as HTMLElement | null;
        if (!host) {
            host = doc.createElement("hson-_style") as HTMLElement;
            host.id = "css-manager";
            doc.body.appendChild(host);
        }

        // find or create the inner <style> tag
        let styleEl = host.querySelector("style#_hson") as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = doc.createElement("style");
            styleEl.setAttribute("id", "_hson");
            host.appendChild(styleEl);
        }

        this.styleEl = styleEl;
        return styleEl;
    }

    //  define or update a rule; empty CSS is ... error? warning?
    public defineRuleString(input: CssRule): void {
        if (!input || typeof input !== "object") {
            throw new Error("CssManager.defineRuleString: invalid input object");
        }

        const { id, selector, body } = input;

        if (typeof id !== "string" || typeof selector !== "string" || typeof body !== "string") {
            // This usually means you passed { id, css } or some other legacy shape
            throw new Error(
                "CssManager.defineRuleString: expected { id, selector, body } strings; " +
                "did you pass { id, css } by accident?"
            );
        }

        const trimmedId = id.trim();
        const trimmedSelector = selector.trim();
        const trimmedBody = body.trim();

        if (!trimmedId) {
            throw new Error("CssManager.defineRuleString: id must be non-empty");
        }
        if (!trimmedSelector) {
            throw new Error(
                `CssManager.defineRuleString(${trimmedId}): selector must be non-empty`,
            );
        }
        if (!trimmedBody) {
            throw new Error(
                `CssManager.defineRuleString(${trimmedId}): body must be non-empty; use removeRule() to delete rules.`,
            );
        }

        const css: string = `${trimmedSelector} { ${trimmedBody} }`;

        this.rules.set(trimmedId, { id: trimmedId, css });
        this.syncToDom();
    }

    public defineRuleBlock(
        id: string,
        selector: string,
        decls: CssProp,
    ): void {
        const parts: string[] = [];
        for (const [prop, v] of Object.entries(decls)) {
            parts.push(`${prop}: ${renderCssValue(v)};`);
        }
        const body: string = parts.join(" ");
        this.defineRuleString({ id, selector, body });
    }

    public defineAtomicRule(
        id: string,
        selector: string,
        property: string,
        value: CssValue,
    ): void {
        const body: string = `${property}: ${renderCssValue(value)};`;
        this.defineRuleString({ id, selector, body });

    }

    // TODO not quite there yet with the api

    /* 
    public beginRule(id: string, selector: string): CssRuleBuilder {
        const mgr = this;
        const decls: Record<string, CssValue> = {};

        // tiny inner object that closes over mgr + decls
        const builder: CssRuleBuilder = {
            id,
            selector,
            
            set(property: string, value: CssValue): CssRuleBuilder {
                decls[property] = value;
                // we *don’t* auto-commit here; you could, but explicit commit is clearer
                return builder;
            },

            setMany(map: Record<string, CssValue>): CssRuleBuilder {
                for (const [prop, v] of Object.entries(map)) {
                    decls[prop] = v;
                }
                return builder;
            },

            commit(): void {
                // delegate to your existing block API
                mgr.defineRuleBlock(id, selector, decls);
            },

            remove(): void {
                mgr.removeRule(id);
            },
        };

        return builder;
    }
 */
    //  explicit deletion API
    public removeRule(id: string): void {
        // CHANGED: explicit remove instead of defineRule("") toggle
        if (!this.rules.has(id)) {
            return;
        }
        this.rules.delete(id);
        this.syncToDom();
    }

    //  clear all managed rules
    public clearAll(): void {
        if (this.rules.size === 0) {
            return;
        }
        this.rules.clear();
        this.syncToDom();
    }

    // OPTIONAL: read back current combined CSS text (for debugging/tests)
    public getCombinedCss(): string {
        return this.buildCombinedCss();
    }

    // INTERNAL: build unified CSS string from current rules
    private buildCombinedCss(): string {
        const parts: string[] = [];

        for (const rule of this.rules.values()) {
            const css = rule.css.trim();
            if (!css) continue;
            parts.push(css);
        }

        // separate rules with blank lines for readability
        return parts.join("\n\n");
    }

    // INTERNAL: push in-memory rules down into the <style> tag
    private syncToDom(): void {
        const styleEl = this.ensureStyleElement();
        styleEl.textContent = this.buildCombinedCss();
    }
}

//  convenience export if you prefer a single shared instance
// export const cssManager: CssManager = CssManager.invoke();