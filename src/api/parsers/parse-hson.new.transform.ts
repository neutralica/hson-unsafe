import {  HsonNode } from "../..";
import { assert_invariants } from "../../utils/assert-invariants.utils";
import { parse_tokens } from "./parse-tokens.new.transform";
import { tokenize_hson_NEW } from "./tokenize-hson.new.transform";



export function parse_hson($str: string): HsonNode {
    const newTokens = tokenize_hson_NEW($str);
    const newNode = parse_tokens(newTokens)
    assert_invariants(newNode, 'parse hson');
    return newNode;
}