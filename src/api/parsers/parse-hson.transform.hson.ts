// parse-hson.transform.hson.ts

import { HsonNode } from "../../types-consts/node.types.hson";
import { parse_tokens } from "./parse-tokens.transform.hson";
import { tokenize_hson } from "./tokenize-hson.transform.hson";

export function parse_hson($hson: string): HsonNode {
    const tokens = tokenize_hson($hson)
    const nodes = parse_tokens(tokens);
    return nodes;
}