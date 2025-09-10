


import { assert_invariants_NEW } from "../../utils/assert-invariants.utils.hson";
import { HsonNode_NEW } from "../../types-consts/node.new.types.hson";
import { parse_tokens_NEW } from "./parse-tokens.new.transform.hson";
import { tokenize_hson_NEW } from "./tokenize-hson.new.transform.hson";


export function parse_hson($str: string): HsonNode_NEW {
    const newTokens = tokenize_hson_NEW($str);
    const newNode = parse_tokens_NEW(newTokens)
    assert_invariants_NEW(newNode);
    return newNode;
}