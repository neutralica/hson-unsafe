import {  HsonNode } from "../..";
import { assert_invariants_NEW } from "../../utils/assert-invariants.utils";
import { parse_tokens_NEW } from "./parse-tokens.new.transform";
import { tokenize_hson_NEW } from "./tokenize-hson.new.transform";



export function parse_hson($str: string): HsonNode {
    const newTokens = tokenize_hson_NEW($str);
    const newNode = parse_tokens_NEW(newTokens)
    assert_invariants_NEW(newNode);
    return newNode;
}