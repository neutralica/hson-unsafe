import { JsonType } from "../../core/types-consts/core.types.hson";
import { HSON_FrameΔ, RenderΔ } from "../../types-consts/constants.hson";
import { FrameMode, FrameOptions, OutputConstructor_2, ProxyBackdoor, RenderFormats } from "../../core/types-consts/constructors.core.types.hson";
import { HsonNode_NEW } from "./node.new.types.hson";

export type FrameRender_NEW = { frame: FrameConstructor_NEW, output: RenderFormats };

export interface FrameConstructor_NEW {
    input: string | Element;
    node: HsonNode_NEW;
    hson?: string;
    html?: string;
    json?: JsonType | string;
    mode?: FrameMode;
    meta?: Record<string, unknown>;
    options?: FrameOptions;
};

 
export interface SourceConstructor_1_NEW {
    fromHSON(input: string): OutputConstructor_2;
    fromJSON(input: string | JsonType): OutputConstructor_2;
    fromHTML(input: string | HTMLElement): OutputConstructor_2;
    fromNode(input: HsonNode_NEW): OutputConstructor_2;
    queryDOM(selector: string): OutputConstructor_2;
    queryBody(): OutputConstructor_2;
}

