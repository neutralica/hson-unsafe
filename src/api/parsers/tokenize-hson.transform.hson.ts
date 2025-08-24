import { Primitive } from "../../core/types-consts/core.types.hson.js";
import { CREATE_TOKEN, TokenΔ, OBJECT_TAG, ARRAY_TAG, ELEM_TAG, ROOT_TAG } from "../../types-consts/constants.hson.js";
import { AllTokens, HSON_Token_Type } from "../../types-consts/tokens.types.hson.js";
import { close_tag_lookahead } from "../../utils/close-tag-lookahead.utils.hson.js";
import { coerce } from "../../utils/coerce-string.utils.hson.js";
import { is_not_string, is_Primitive } from "../../core/utils/guards.core.utils.hson.js";
import { parse_css_attrs } from "../../utils/parse-css.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { split_top_OLD } from "../../utils/split-top-level.utils.hson.js";
import { _throw_transform_err } from "../../utils/throw-transform-err.utils.hson.js";
import { HsonAttrs, HsonFlags, HsonNode } from "../../types-consts/node.types.hson.js";
import { is_Node } from "../../utils/node-guards.utils.hson.js";
import { SHADOW_ENABLED } from "../../_refactor/flags/flags.refactor.hson.js";
import { toOLD } from "../../_refactor/kompat/kompat-layer.refactor.hson.js";
import { tokenize_hson_NEW } from "../../new/api/parsers/tokenize-hson.new.transform.hson.js";
import { tokenize_hson_OLD } from "../../old/api/parsers/tokenize-hson.old.transform.hson.js";
import { parse_tokens_OLD } from "../../old/api/parsers/parse-tokens.old.transform.hson.js";
import { parse_tokens_NEW } from "../../new/api/parsers/parse-tokens.new.transform.hson.js";
import { clone_node } from "../../utils/clone-node.utils.hson.js";
import { diff_old_nodes, equal_old_nodes } from "../../_refactor/_refactor-utils/compare-nodes.utils.hson.js";
import { bucket_diffs } from "../../_refactor/_refactor-utils/bucket-diffs.utils.hson.js";



/* stable entry: returns OLD; NEW is only used for parity checks */
export function tokenize_hson($src: string): HsonNode {

    const oldTokens = tokenize_hson_OLD($src);
    const oldNode = parse_tokens_OLD(oldTokens)

    if (SHADOW_ENABLED()) {
        console.log('shadow tests running - html')
        try {
            const newNodeToOld = toOLD(parse_tokens_NEW(tokenize_hson_NEW($src)));

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
