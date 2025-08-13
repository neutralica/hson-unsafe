/* serialize-json.render.hson.ts */

/* keep: OLD is the truth we return */
import { serialize_json_OLD } from "../../old/api/serializers/serialize-json.old.render.hson";

/* shadow inputs */
import { serialize_json_NEW } from "../../new/api/serializers/serialize-json.new.render.hson";
import { toNEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { SHADOW_JSON } from "../../_refactor/flags/flags.refactor.hson";
import type { HsonNode } from "../../types-consts/node.types.hson";

/* tiny canonical compare (or import your canonicalizer) */
function canonicalize(x: unknown): string {
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

/* exported wrapper */
export function serialize_json($node: HsonNode): string {
    const oldStr = serialize_json_OLD($node);

    if (SHADOW_JSON) {
        try {
            const newStr = serialize_json_NEW(toNEW($node));
            const a = JSON.parse(oldStr);
            const b = JSON.parse(newStr);
            if (canonicalize(a) !== canonicalize(b)) {
                /* non-fatal: log and keep returning OLD */
                console.warn("[shadow-json][serialize] parity mismatch");
            }
        } catch (e: any) {
            console.error("[shadow-json][serialize] NEW crashed:", e.message);
        }
    }

    return oldStr;
}
