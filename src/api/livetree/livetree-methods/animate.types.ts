// animate.types.ts

export type AnimationName = string;
export type AnimationEndMode = "name-only" | "clear-all";
export type AnimationSpec = Readonly<{
  name: AnimationName;

  // Optional sugar: if omitted, user can define these in CSS rules/classes instead.
  duration: string;          // "250ms", "1s"
  timingFunction?: string;    // "ease", "linear", "cubic-bezier(...)"
  delay?: string;             // "0ms"
  iterationCount?: string;    // "1", "infinite"
  direction?: string;         // "normal", "reverse", ...
  fillMode?: string;          // "none", "forwards", "both", ...
  playState?: string;         // "running", "paused"
}>;

export type AnimAdapters<TTree> = Readonly<{
  //  one canonical way to set a single CSS property on the selection.
  setStyleProp: (tree: TTree, prop: string, value: string) => TTree;

  //  iterate selected DOM elements (for forcing reflow on all if desired).
  forEachDomElement: (tree: TTree, fn: (el: Element) => void) => void;

  //  get one DOM element (for minimal reflow poke).
  getFirstDomElement: (tree: TTree) => Element | undefined;
}>;

export type AnimApi<TTree> = Readonly<{
  // “Guaranteed to run” path.
  begin: (tree: TTree, spec: AnimationSpec) => TTree;
  restart: (tree: TTree, spec: AnimationSpec) => TTree;

  // “You’re on your own” path: duration/etc must be provided by CSS rules elsewhere.
  beginName: (tree: TTree, name: AnimationName) => TTree;
  restartName: (tree: TTree, name: AnimationName) => TTree;

  // Stop is unambiguous.
  end: (tree: TTree, mode?: AnimationEndMode) => TTree;
}>;

export type CssAnimHandle = Readonly<{
  begin: (spec: AnimationSpec) => void;
  restart: (spec: AnimationSpec) => void;
  beginName: (name: AnimationName) => void;
  restartName: (name: AnimationName) => void;
  end: (mode?: "name-only" | "clear-all") => void;
}>;