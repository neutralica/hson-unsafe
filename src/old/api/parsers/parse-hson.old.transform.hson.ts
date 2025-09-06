
import { HsonNode } from "../../../types-consts/node.types.hson";
import { parse_tokens_OLD } from "./parse-tokens.old.transform.hson";
import { tokenize_hson_OLD } from "./tokenize-hson.old.transform.hson";



export function parse_hson_OLD($str: string): HsonNode{
    console.error('parse_hson_OLD called--discontinue use of this function; switch to parse_hson_NEW')
    const oldTokens = tokenize_hson_OLD($str);
    const oldNode = parse_tokens_OLD(oldTokens)

    return oldNode;
}