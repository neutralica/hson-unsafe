/* serialize-json.render.hson.ts */

/* keep: OLD is the truth we return */
import { serialize_json_OLD } from "../../old/api/serializers/serialize-json.old.render.hson";

/* shadow inputs */
import { serialize_json_NEW } from "../../new/api/serializers/serialize-json.new.render.hson";
import { to_NEW } from "../../_refactor/kompat/kompat-layer.refactor.hson";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson";
import type { HsonNode } from "../../types-consts/node.types.hson";
import { canonicalize } from "../../utils/canonicalize.utils.hson";
import { assert_invariants_NEW } from "../../new/utils/assert-invariants.utils.hson";

/* exported wrapper */
export function serialize_json($node: HsonNode): string {
    console.log('serializing json - beginning')
    const oldStr = serialize_json_OLD($node);

    if (SHADOW_ENABLED()) {
        try {
            assert_invariants_NEW(to_NEW($node));
            const newStr = serialize_json_NEW(to_NEW($node));
            const a = JSON.parse(oldStr);
            const b = JSON.parse(newStr);
            if (canonicalize(a) !== canonicalize(b)) {
                /* non-fatal: log and keep returning OLD */
                console.warn("[shadow-json][serialize] parity mismatch");
            } else console.log('SUCCESS! both new and old node paths match')
        } catch (e: any) {
            console.error("[shadow-json][serialize] NEW crashed:", e.message);
        }
    }

    return oldStr;
}
