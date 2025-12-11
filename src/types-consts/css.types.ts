import { StyleKey } from "../api/livetree/livetree-methods/style-manager2.utils";

// helper: a structured value we can do math on later
export type CssUnit =
  | "px"
  | "em"
  | "rem"
  | "%"
  | "vh"
  | "vw"
  | "s"
  | "ms"
  | "deg"
  | "_"; // unitless

export type CssValue = string | { value: number; unit: CssUnit };


//  this stays as the *stored* representation
export interface CssText {
  // stable identifier for this rule within CssManager
  id: string;
  // fully rendered CSS text, e.g. `* { background-color: red; }`
  css: string;
}

//  structured input for string-based rules
export interface CssRule {
  id: string;
  selector: string; // e.g. "*", "body", "[_hson-flag]"
  body: string;     // e.g. "background-color: red;"
}

export type CssProp = Record<string, CssValue>;

export type CssRuleBlock = {
  selector: string;
  declarations: CssProp;
};

export interface CssRuleBuilder {
  readonly id: string;
  readonly selector: string;

  set(property: string, value: CssValue): CssRuleBuilder;
  setMany(decls: Record<string, CssValue>): CssRuleBuilder;

  // apply current declarations to CssManager
  commit(): void;

  // convenience: remove rule from CssManager
  remove(): void;
}

export type StyleObject = Partial<Record<StyleKey, string | number | null | undefined>>;
