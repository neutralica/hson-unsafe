import { AnimAdapters, AnimApi, AnimationSpec, AnimationName } from "./animate.types";

// move to css.types.ts when verified used
export type CssScope = Readonly<{ quids: readonly string[] }>;

export function normalizeName(name: string): string {
  const n = name.trim();
  if (n === "") throw new Error(`animation name cannot be empty.`);
  return n;
}

function applyNameOnly<TTree>(tree: TTree, name: string, a: AnimAdapters<TTree>): TTree {
  return a.setStyleProp(tree, "animation-name", normalizeName(name));
}

function normalizeSpec(spec: AnimationSpec): AnimationSpec {
  const name = normalizeName(spec.name);

  const duration = spec.duration.trim();
  if (duration === "") {
    throw new Error(`begin_animation: spec.duration cannot be empty.`);
  }

  return {
    ...spec,
    name,
    duration,
    timingFunction: spec.timingFunction?.trim(),
    delay: spec.delay?.trim(),
    iterationCount: spec.iterationCount?.trim(),
    direction: spec.direction?.trim(),
    fillMode: spec.fillMode?.trim(),
    playState: spec.playState?.trim(),
  };
}

function applyAnimationProps<TTree>(
  tree: TTree,
  spec: AnimationSpec,
  a: AnimAdapters<TTree>,
): TTree {
  // CHANGED: apply only properties present in spec.
  // NOTE: we DO NOT set shorthand; we expand to explicit animation-* props.

  // CHANGED: always set name.
  tree = a.setStyleProp(tree, "animation-name", spec.name);

  if (spec.duration !== undefined) {
    tree = a.setStyleProp(tree, "animation-duration", spec.duration.trim());
  }

  if (spec.timingFunction !== undefined) {
    tree = a.setStyleProp(tree, "animation-timing-function", spec.timingFunction.trim());
  }

  if (spec.delay !== undefined) {
    tree = a.setStyleProp(tree, "animation-delay", spec.delay.trim());
  }

  if (spec.iterationCount !== undefined) {
    tree = a.setStyleProp(tree, "animation-iteration-count", spec.iterationCount.trim());
  }

  if (spec.direction !== undefined) {
    tree = a.setStyleProp(tree, "animation-direction", spec.direction.trim());
  }

  if (spec.fillMode !== undefined) {
    tree = a.setStyleProp(tree, "animation-fill-mode", spec.fillMode.trim());
  }

  if (spec.playState !== undefined) {
    tree = a.setStyleProp(tree, "animation-play-state", spec.playState.trim());
  }

  return tree;
}

function forceReflow(tree: unknown, el: Element): void {
  // CHANGED: the “restart” trick requires a layout read.
  // We use HTMLElement.offsetHeight where possible; fallback to getBoundingClientRect.
  const h = el as HTMLElement;

  if (typeof h.offsetHeight === "number") {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    h.offsetHeight;
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  el.getBoundingClientRect().height;
}

// ------------------------------------------------------------
// Factory
// ------------------------------------------------------------
export function apply_animation<TTree>(adapters: AnimAdapters<TTree>): AnimApi<TTree> {
  return {
    begin(tree: TTree, spec: AnimationSpec): TTree {
      // CHANGED: normalize + apply explicit properties (duration now required).
      const s = normalizeSpec(spec);
      return applyAnimationProps(tree, s, adapters);
    },

    beginName(tree: TTree, name: AnimationName): TTree {
      return applyNameOnly(tree, name, adapters);
    },


    end(tree: TTree, mode: "name-only" | "clear-all" = "name-only"): TTree {
      tree = adapters.setStyleProp(tree, "animation-name", "none");

      if (mode === "clear-all") {
        tree = adapters.setStyleProp(tree, "animation-duration", "");
        tree = adapters.setStyleProp(tree, "animation-timing-function", "");
        tree = adapters.setStyleProp(tree, "animation-delay", "");
        tree = adapters.setStyleProp(tree, "animation-iteration-count", "");
        tree = adapters.setStyleProp(tree, "animation-direction", "");
        tree = adapters.setStyleProp(tree, "animation-fill-mode", "");
        tree = adapters.setStyleProp(tree, "animation-play-state", "");
      }

      return tree;
    },

    restart(tree: TTree, spec: AnimationSpec): TTree {
      const s = normalizeSpec(spec);

      tree = adapters.setStyleProp(tree, "animation-name", "none");

      const first = adapters.getFirstDomElement(tree);
      if (first) forceReflow(tree, first);

      tree = applyAnimationProps(tree, s, adapters);
      return tree;
    },

    // CHANGED: explicit “you’re on your own” name-only restart.
    restartName(tree: TTree, name: AnimationName): TTree {
      // CHANGED: normalize + reuse helper.
      tree = adapters.setStyleProp(tree, "animation-name", "none");

      const first = adapters.getFirstDomElement(tree);
      if (first) forceReflow(tree, first);

      return applyNameOnly(tree, name, adapters);
    },
  };
}