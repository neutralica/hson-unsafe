

import { CssCustomPropName, PropertyInput, PropertyInputTuple, PropertyManager, PropertyRegistration, PropertySyntax } from "../../../types-consts/at-property.types";

function isPropTuple(x: PropertyInput): x is PropertyInputTuple {
    // tuples are arrays at runtime; objects are not.
    return Array.isArray(x);
}
function normalizePropInput(input: PropertyInput): PropertyRegistration {
    // tuple:
    if (isPropTuple(input)) {
        const [name, syn, initOrUndefined, inhOrUndefined] = input;
        const init: string | undefined = initOrUndefined?.trim();
        const inh: boolean = inhOrUndefined ?? false;

        // CHANGED: enforce init unless "*"
        if (syn !== "*" && (!init || init === "")) {
            throw new Error(`@property ${name}: init is required when syntax is not "*".`);
        }

        return { name, syn, inh, init };
    }

    // object:
    const name = input.name;
    const syn = input.syn;
    const inh = input.inh ?? false;
    const init = input.init?.trim();

    if (syn !== "*" && (!init || init === "")) {
        throw new Error(`@property ${name}: init is required when syntax is not "*".`);
    }

    return { name, syn, inh, init };
}
// ----------------------------------------------
export function manage_property(args: {
    // Called whenever registrations change.
    onChange: () => void;
}): PropertyManager {
    // CHANGED: internal storage is canonical normalized registrations by name.
    const regByName: Map<CssCustomPropName, PropertyRegistration> = new Map();

    // CHANGED: normalize all inputs into the canonical shape.
    // function normalize(input: PropertyInput): PropertyRegistration {
    //     // CHANGED: tuple → object normalization.
    //     if (Array.isArray(input)) {
    //         // CHANGED: destructure by position.
    //         const [name, syn, initOrUndefined, inhOrUndefined] = input;

    //         // CHANGED: interpret third slot as init (if present).
    //         const init: string | undefined = initOrUndefined;

    //         // CHANGED: interpret fourth slot as inh (if present), default false.
    //         const inh: boolean = inhOrUndefined ?? false;

    //         // CHANGED: validate required init unless syn === "*".
    //         if (syn !== "*" && (init === undefined || init.trim() === "")) {
    //             throw new Error(`@property ${name}: init is required when syntax is not "*".`);
    //         }

    //         // CHANGED: return canonical form with trimmed init.
    //         return { name, syn, inh, init: init?.trim() };
    //     }

    //     // CHANGED: object input defaults and validation.
    //     const name: CssCustomPropName = input.name;
    //     const syn: PropertySyntax = input.syn;
    //     const inh: boolean = input.inh ?? false;
    //     const init: string | undefined = input.init?.trim();

    //     // CHANGED: validate required init unless syn === "*".
    //     if (syn !== "*" && (init === undefined || init === "")) {
    //         throw new Error(`@property ${name}: init is required when syntax is not "*".`);
    //     }

    //     // CHANGED: canonical form.
    //     return { name, syn, inh, init };
    // }

    // CHANGED: render a single canonical registration.
    function renderReg(r: PropertyRegistration): string {
        // CHANGED: build lines explicitly; init is optional only for "*".
        const lines: string[] = [];

        // CHANGED: start at-rule block.
        lines.push(`@property ${r.name} {`);

        // CHANGED: syntax is always required.
        lines.push(`  syntax: "${r.syn}";`);

        // CHANGED: inherits is always emitted explicitly.
        lines.push(`  inherits: ${r.inh ? "true" : "false"};`);

        // CHANGED: initial-value is emitted only if present.
        if (r.init !== undefined) {
            lines.push(`  initial-value: ${r.init};`);
        }

        // CHANGED: end block.
        lines.push(`}`);

        // CHANGED: join with newlines.
        return lines.join("\n");
    }

    // CHANGED: public API implementation.
    return {
        register(input: PropertyInput): void {
            const next = normalizePropInput(input);
            const prev = regByName.get(next.name);

            // CHANGED: cheap equality check; normalize ensures stable strings.
            const isSame =
                prev !== undefined &&
                prev.syn === next.syn &&
                prev.inh === next.inh &&
                prev.init === next.init;

            if (isSame) return; // CHANGED: avoid pointless re-render.

            regByName.set(next.name, next);
            args.onChange();
        },

        registerMany(inputs: readonly PropertyInput[]): void {
            // CHANGED: batch normalize + set.
            for (const input of inputs) {
                const reg: PropertyRegistration = normalizePropInput(input);
                regByName.set(reg.name, reg);
            }
            args.onChange();
        },

        unregister(name: CssCustomPropName): void {
            // CHANGED: delete and mark changed if something was removed.
            const didDelete: boolean = regByName.delete(name);
            if (didDelete) args.onChange();
        },

        has(name: CssCustomPropName): boolean {
            // CHANGED: trivial query.
            return regByName.has(name);
        },

        get(name: CssCustomPropName): PropertyRegistration | undefined {
            // CHANGED: return canonical registration (already readonly).
            return regByName.get(name);
        },

        renderOne(name: CssCustomPropName): string {
            // CHANGED: render one or empty string if missing.
            const reg: PropertyRegistration | undefined = regByName.get(name);
            return reg ? renderReg(reg) : "";
        },

        renderAll(): string {
            // CHANGED: sort keys for deterministic output (diff/test friendly).
            const names: CssCustomPropName[] = Array.from(regByName.keys()).sort();

            // CHANGED: render in sorted order.
            const blocks: string[] = [];
            for (const name of names) {
                const reg = regByName.get(name);
                if (reg) blocks.push(renderReg(reg));
            }

            return blocks.join("\n\n");
        }
    };
}