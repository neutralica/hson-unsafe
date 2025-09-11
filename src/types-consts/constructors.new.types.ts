
import { RenderFormats, FrameMode, FrameOptions, OutputConstructor_2 } from "../core/types-consts/constructors.core.types";
import { JsonType } from "../core/types-consts/core.types";
import { HsonNode } from "./node.new.types";

export type FrameRender = { frame: FrameConstructor, output: RenderFormats };

export interface FrameConstructor {
    input: string | Element;
    node: HsonNode;
    hson?: string;
    html?: string;
    json?: JsonType | string;
    mode?: FrameMode;
    meta?: Record<string, unknown>;
    options?: FrameOptions;
};

 
export interface SourceConstructor_1 {
    fromHSON(input: string): OutputConstructor_2;
    fromJSON(input: string | JsonType): OutputConstructor_2;
    fromHTML(input: string | HTMLElement): OutputConstructor_2;
    fromNode(input: HsonNode): OutputConstructor_2;
    queryDOM(selector: string): OutputConstructor_2;
    queryBody(): OutputConstructor_2;
}

