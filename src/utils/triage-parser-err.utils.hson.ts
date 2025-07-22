// error-in-parser.utils.hson.ts

import { _ERROR, NEW_NODE } from "../types-consts/constants.types.hson.js";

export function triage_parse_err(err: string, _STRICT = true) {
    if (_STRICT) {
        throw new Error(err);
    } else {
        console.error(err);
    }
}