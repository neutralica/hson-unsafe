// canonicalize.utils.hson.ts

export function canonicalize(x: unknown): string {
    return JSON.stringify(sortKeys(x));
}
function sortKeys(v: unknown): unknown {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
}
