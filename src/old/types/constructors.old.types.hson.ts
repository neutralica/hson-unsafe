import { JsonType } from "../../core/types-consts/core.types.hson";
import { FrameMode, FrameOptions, OutputConstructor_2, RenderFormats } from "../../core/types-consts/constructors.core.types.hson";
import { HsonNode } from "../../types-consts/node.types.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";


export interface FrameConstructor {
    input: string | Element;
    node: HsonNode;
    hson?: string;
    html?: string;
    json?: JsonType | string;
    mode?: FrameMode;
    meta?: Record<string, unknown>;
    options?: FrameOptions;
}
;

export type FrameRender = { frame: FrameConstructor; output: RenderFormats; };/* step 1: the initial input source */

export interface SourceConstructor_1 {
    fromHSON(input: string): OutputConstructor_2;
    fromJSON(input: string | JsonType): OutputConstructor_2;
    fromHTML(input: string | HTMLElement): OutputConstructor_2;
    fromNode(input: HsonNode): OutputConstructor_2;
    queryDOM(selector: string): OutputConstructor_2;
    queryBody(): OutputConstructor_2;
}

