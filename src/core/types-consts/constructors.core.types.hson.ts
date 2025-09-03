// constructors.types.hson.ts

import { RenderΔ, HSON_FrameΔ} from "../../types-consts/constants.hson.js";
import { HsonNode } from "../../types-consts/node.types.hson.js";

export type ProxyBackdoor = { _withNodes: HsonNode; [key: string]: any; };

export type RenderFormats = (typeof RenderΔ)[keyof typeof RenderΔ];

/* step 2: the output format selection
    returns an object that is a combination of the optional step (3) and the 
    final step (4), allowing the user to skip step 3 if no options are needed. */
export interface OutputConstructor_2 {
    toJSON(): OptionsConstructor_3 & RenderConstructor_4;
    toHTML(): OptionsConstructor_3 & RenderConstructor_4;
    toHSON(): OptionsConstructor_3 & RenderConstructor_4;
   /*  "dev mode" only? */
    asTree(): ProxyBackdoor;
}

/* step 3: The optional configuration methods. Each one returns the final step */
export interface OptionsConstructor_3 {
    withOptions(opts: Partial<FrameOptions>): RenderConstructor_4;
    noBreak(): RenderConstructor_4;
    spaced(): RenderConstructor_4;
    linted(): RenderConstructor_4;
}

/* OptionsConstructor_3 depends on */
export interface FrameOptions {
    spaced?: boolean;
    lineLength?: number;
    linted?: boolean;
    noBreak?: boolean;
};

/* step 4: The final actions */
export interface RenderConstructor_4 {
    serialize(): string;
    parse(): any;
    asBranch(): any;
}

export type FrameMode = (typeof HSON_FrameΔ)[keyof typeof HSON_FrameΔ];
