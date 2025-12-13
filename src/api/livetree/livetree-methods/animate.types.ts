// types (keep small; mirror CSS)
export type AnimationName = string;

export type AnimationSpec = Readonly<{
  name: AnimationName;

  // Optional sugar: if omitted, user can define these in CSS rules/classes instead.
  duration?: string;          // "250ms", "1s"
  timingFunction?: string;    // "ease", "linear", "cubic-bezier(...)"
  delay?: string;             // "0ms"
  iterationCount?: string;    // "1", "infinite"
  direction?: string;         // "normal", "reverse", ...
  fillMode?: string;          // "none", "forwards", "both", ...
  playState?: string;         // "running", "paused"
}>;

export type AnimAdapters<TTree> = Readonly<{
  // CHANGED: one canonical way to set a single CSS property on the selection.
  setStyleProp: (tree: TTree, prop: string, value: string) => TTree;

  // CHANGED: iterate selected DOM elements (for forcing reflow on all if desired).
  forEachDomElement: (tree: TTree, fn: (el: Element) => void) => void;

  // CHANGED: get one DOM element (for minimal reflow poke).
  getFirstDomElement: (tree: TTree) => Element | undefined;
}>;

export type AnimApi<TTree> = Readonly<{
  begin_animation: (tree: TTree, spec: AnimationSpec) => TTree;
  end_animation: (tree: TTree, mode?: "name-only" | "clear-all") => TTree;
  restart_animation: (tree: TTree, spec: AnimationSpec) => TTree;
}>;