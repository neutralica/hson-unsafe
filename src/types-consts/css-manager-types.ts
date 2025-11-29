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

// 
// NEW: this stays as the *stored* representation
export interface CssText {
  // stable identifier for this rule within CssManager
  id: string;
  // fully rendered CSS text, e.g. `* { background-color: red; }`
  css: string;
}

// NEW: structured input for string-based rules
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

type KeyframesBlock = {
    name: string;
    steps: Record<string, Record<string, string>>;
    // "0%" -> { opacity: "0" }, "100%" -> { opacity: "1" }
  };

type PropertyBlock = {
  name: string;  // "--foo"
  syntax?: string;
  inherits?: boolean;
  initialValue?: string;
};