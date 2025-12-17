// animate.ts

import { AnimAdapters, AnimApi, AnimationSpec, AnimationName } from "./animate.types";

// export type CssScope = Readonly<{ quids: readonly string[] }>;

/**
 * Normalize and validate an animation/keyframes name.
 *
 * Trims surrounding whitespace and rejects the empty string. This is used as a
 * boundary guard for APIs that set `animation-name` or refer to named
 * `@keyframes` blocks.
 *
 * @param name
 *   The raw name from user input.
 *
 * @returns
 *   The trimmed, non-empty name.
 *
 * @throws {Error}
 *   If the trimmed name is empty.
 */
export function normalizeName(name: string): string {
  const n = name.trim();
  if (n === "") throw new Error(`animation name cannot be empty.`);
  return n;
}

/**
 * Apply only the `animation-name` property to a tree scope via adapters.
 *
 * This is the smallest possible “start animation” operation: it does not set
 * duration, timing function, etc. It’s useful when the caller wants to manage
 * other `animation-*` properties elsewhere (or rely on CSS defaults).
 *
 * @typeParam TTree
 *   The caller’s “scope” type (e.g., a QUID selection object).
 *
 * @param tree
 *   The target scope to modify.
 *
 * @param name
 *   The animation/keyframes name. Will be normalized/validated.
 *
 * @param a
 *   Adapter surface used to apply `animation-name` to the scope.
 *
 * @returns
 *   The updated scope (usually the same reference, depending on adapters).
 */
function applyNameOnly<TTree>(tree: TTree, name: string, a: AnimAdapters<TTree>): TTree {
  return a.setStyleProp(tree, "animation-name", normalizeName(name));
}

/**
 * Normalize and validate an `AnimationSpec` at the boundary.
 *
 * This function enforces invariants that make downstream operations predictable:
 * - `spec.name` is trimmed and must be non-empty
 * - `spec.duration` is required and must be non-empty after trim
 * - all optional string fields are trimmed (or remain `undefined`)
 *
 * The returned object is safe to feed into `applyAnimationProps()` without
 * repeating validation and trim logic.
 *
 * @param spec
 *   The raw animation specification from the caller.
 *
 * @returns
 *   A normalized spec with required fields validated and optional fields trimmed.
 *
 * @throws {Error}
 *   If `name` is empty after trimming, or if `duration` is empty after trimming.
 */
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

/**
 * Apply an `AnimationSpec` to a tree scope by expanding it into explicit
 * `animation-*` properties.
 *
 * Notes:
 * - This intentionally does **not** set the `animation` shorthand; it writes
 *   explicit longhand properties for clarity and easier incremental updates.
 * - Only properties present in `spec` are applied (except `animation-name`,
 *   which is always set).
 * - `spec` is expected to be pre-normalized (see `normalizeSpec()`).
 *
 * @typeParam TTree
 *   The caller’s “scope” type (e.g., a QUID selection object).
 *
 * @param tree
 *   The target scope to modify.
 *
 * @param spec
 *   The normalized animation spec to apply.
 *
 * @param a
 *   Adapter surface used to write style properties to the scope.
 *
 * @returns
 *   The updated scope (usually the same reference, depending on adapters).
 */
function applyAnimationProps<TTree>(
  tree: TTree,
  spec: AnimationSpec,
  a: AnimAdapters<TTree>,
): TTree {
  //  apply only properties present in spec.
  // NOTE: we DO NOT set shorthand; we expand to explicit animation-* props.

  //  always set name.
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

/**
 * Force a layout read to make CSS animation restarts take effect.
 *
 * Many “restart animation” recipes rely on:
 *   1) setting `animation-name: none`
 *   2) forcing a layout flush (a read that requires layout)
 *   3) re-applying the animation properties
 *
 * This helper performs the layout read using `HTMLElement.offsetHeight` when
 * available, and falls back to `getBoundingClientRect()` otherwise.
 *
 * @param tree
 *   Unused by this implementation, but kept for signature symmetry and future
 *   adapter designs where the scope might influence the reflow strategy.
 *
 * @param el
 *   A real DOM element associated with the scope (typically the first match).
 */
function forceReflow(tree: unknown, el: Element): void {
  //  the “restart” trick requires a layout read.
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

/**
 * Create a small, framework-agnostic animation API over an arbitrary “tree scope”
 * using adapters.
 *
 * This factory does not know about LiveTree, QUIDs, DOM selection, or CSS rule
 * storage. Instead, it delegates all mutation and DOM access to `AnimAdapters`.
 *
 * The returned API supports four main operations:
 * - `begin(spec)`: apply a normalized spec as explicit `animation-*` properties
 * - `beginName(name)`: set only `animation-name` (minimal entry)
 * - `end(mode)`: stop animations by setting `animation-name: none` (optionally clear all)
 * - `restart(spec|name)`: stop, force reflow, then re-apply (common “restart trick”)
 *
 * Important semantics:
 * - `duration` is required for `begin()`/`restart()` (enforced by `normalizeSpec()`).
 * - Restart uses a single DOM element from the scope (`getFirstDomElement`) to
 *   trigger layout flush; if none exists, restart degrades to “re-apply props”
 *   without forcing reflow.
 *
 * @typeParam TTree
 *   The caller’s “scope” type (e.g., `{ quids: string[] }`, or a DOM collection).
 *
 * @param adapters
 *   Adapter functions that define how to:
 *   - set a style property on the scope (`setStyleProp`)
 *   - find DOM elements for the scope (`getFirstDomElement`, etc.)
 *
 * @returns
 *   An `AnimApi<TTree>` implementing begin/restart/end operations over the scope.
 */
export function apply_animation<TTree>(adapters: AnimAdapters<TTree>): AnimApi<TTree> {
  return {
    begin(tree: TTree, spec: AnimationSpec): TTree {
      //  normalize + apply explicit properties (duration now required).
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

    //  explicit “you’re on your own” name-only restart.
    restartName(tree: TTree, name: AnimationName): TTree {
      //  normalize + reuse helper.
      tree = adapters.setStyleProp(tree, "animation-name", "none");

      const first = adapters.getFirstDomElement(tree);
      if (first) forceReflow(tree, first);

      return applyNameOnly(tree, name, adapters);
    },
  };
}