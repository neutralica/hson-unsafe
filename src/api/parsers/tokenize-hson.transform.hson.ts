// tokenize-hson.transform.hson.ts

import { _throw_transform_err } from "../../utils/throw-transform-err.utils.hson.js";
import { HsonNode } from "../../types-consts/node.types.hson.js";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson.js";
import { to_OLD } from "../../_refactor/kompat/kompat-layer.refactor.hson.js";
import { tokenize_hson_NEW } from "../../new/api/parsers/tokenize-hson.new.transform.hson.js";
import { tokenize_hson_OLD } from "../../old/api/parsers/tokenize-hson.old.transform.hson.js";
import { parse_tokens_OLD } from "../../old/api/parsers/parse-tokens.old.transform.hson.js";
import { parse_tokens_NEW } from "../../new/api/parsers/parse-tokens.new.transform.hson.js";
import { clone_node } from "../../utils/clone-node.utils.hson.js";
import { diff_old_nodes, equal_old_nodes } from "../../_refactor/_refactor-utils/compare-normalize.utils.hson.js";
import { bucket_diffs } from "../../_refactor/_refactor-utils/bucket-diffs.utils.hson.js";



/* stable entry: returns OLD; NEW is only used for parity checks */
export function tokenize_hson_DO_NOT_USE($src: string): HsonNode {
    console.error('DO NOT USE THIS TOKENIZER - leaving during the refactor, then removing');
    const oldTokens = tokenize_hson_OLD($src);
    const oldNode = parse_tokens_OLD(oldTokens)

    if (SHADOW_ENABLED()) {
        console.log('shadow tests running - html')
        try {
            const newNodeToOld = to_OLD(parse_tokens_NEW(tokenize_hson_NEW($src)));

            const a = clone_node(oldNode);
            const b = clone_node(newNodeToOld);

            console.groupCollapsed('SHADOW_ENABLED - test results:');
            console.log(a);
            console.log(b);
            console.groupEnd();
            if (!equal_old_nodes(a, b)) {
                const diffs = diff_old_nodes(a, b, 10);
                const buckets = bucket_diffs(diffs);
                console.warn("[shadow-html][parse] mismatch(len=%d): %o | top=%o",
                    diffs.length, diffs.slice(0, 10), buckets);
            } else console.log('OK - nodes are equal!')
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[shadow-html][parse] NEW crashed:", msg);
        }
    }

    return oldNode;
}
