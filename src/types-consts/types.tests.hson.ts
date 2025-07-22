// types.test.hson.ts

import { HsonNode } from "./base.types.hson";

export interface TestResult_3Way {
    input: string;
    hsonString: string;
    jsonString: string;
    htmlString: string;
    output: string;

    nodeFromJson: HsonNode;
    nodeFromHson: HsonNode;
    nodeFromHtml: HsonNode;
}

