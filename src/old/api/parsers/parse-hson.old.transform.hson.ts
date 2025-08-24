import { bucket_diffs } from "../../../_refactor/_refactor-utils/bucket-diffs.utils.hson";
import { equal_old_nodes, diff_old_nodes } from "../../../_refactor/_refactor-utils/compare-nodes.utils.hson";
import { SHADOW_ENABLED } from "../../../_refactor/flags/flags.refactor.hson";
import { toOLD } from "../../../_refactor/kompat/kompat-layer.refactor.hson";
import { parse_tokens } from "../../../api/parsers/parse-tokens.transform.hson";
import { parse_tokens_NEW } from "../../../new/api/parsers/parse-tokens.new.transform.hson";
import { tokenize_hson_NEW } from "../../../new/api/parsers/tokenize-hson.new.transform.hson";
import { HsonNode_NEW } from "../../../new/types-consts/node.new.types.hson";
import { HsonNode } from "../../../types-consts/node.types.hson";
import { clone_node } from "../../../utils/clone-node.utils.hson";
import { parse_tokens_OLD } from "./parse-tokens.old.transform.hson";
import { tokenize_hson_OLD } from "./tokenize-hson.old.transform.hson";



export function parse_hson_OLD($str: string): HsonNode{
    const oldTokens = tokenize_hson_OLD($str);
    const oldNode = parse_tokens_OLD(oldTokens)

    return oldNode;
}