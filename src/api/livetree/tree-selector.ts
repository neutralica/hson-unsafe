// tree-selector.ts

import { ListenerBuilder, ListenerSub, MissingPolicy } from "../../types-consts/listen.types";
import { FindWithById, LiveTreeCreateHelper, TagName, TreeSelectorCreateHelper } from "../../types-consts/livetree.types";
import { css_for_quids } from "./livetree-methods/css-manager";
import { CssHandle } from "../../types-consts/css.types";
import { DataManager, DatasetObj, DatasetValue } from "./livetree-methods/data-manager";
import { build_listener } from "./livetree-methods/listen";
import { LiveTree } from "./livetree";
import { Primitive } from "../../types-consts/core.types";
import { make_selector_create, make_tree_create } from "./livetree-methods/create-typed";
import { make_style_setter, StyleSetter } from "./livetree-methods/style-setter";
import { FindMany, FindQuery, FindQueryMany } from "./livetree-methods/find";
import { TreeSelector2 } from "./tree-selector-2";

/**
 * Combine multiple `ListenerSub` subscriptions into a single subscription.
 *
 * The returned subscription reports a summed `count`, an `ok` flag that is
 * true if any sub is ok, and an `off()` method that calls `off()` on each
 * provided sub in order.
 *
 * Assumes each `sub.off()` is idempotent; this helper does not attempt to
 * guard against double-disposal beyond delegating to the subs themselves.
 *
 * @param subs
 *   Subscriptions to combine.
 *
 * @returns
 *   A single `ListenerSub` that aggregates counters/flags and disposes all subs.
 */
function combineSubs(subs: readonly ListenerSub[]): ListenerSub {
  // combined off() calls all; idempotency assumed per sub.off()
  return {
    count: subs.reduce((n, s) => n + s.count, 0),
    ok: subs.some(s => s.ok),
    off(): void {
      for (const s of subs) s.off();
    },
  };
}
// CHANGED: one canonical list of the "convenience" ListenerBuilder endpoints
const LISTENER_FNS = [
  // Form / input
  "onInput", "onChange", "onSubmit",

  // Mouse
  "onClick", "onDblClick", "onContextMenu",
  "onMouseMove", "onMouseDown", "onMouseUp",
  "onMouseEnter", "onMouseLeave",

  // Pointer
  "onPointerDown", "onPointerMove", "onPointerUp",
  "onPointerEnter", "onPointerLeave", "onPointerCancel",

  // Touch
  "onTouchStart", "onTouchMove", "onTouchEnd", "onTouchCancel",

  // Wheel / scroll
  "onWheel", "onScroll",

  // Keyboard
  "onKeyDown", "onKeyUp",

  // Focus
  "onFocus", "onBlur", "onFocusIn", "onFocusOut",

  // Drag & drop
  "onDragStart", "onDragOver", "onDrop", "onDragEnd",

  // Animation
  "onAnimationStart", "onAnimationIteration", "onAnimationEnd", "onAnimationCancel",

  // Transition
  "onTransitionStart", "onTransitionEnd", "onTransitionCancel", "onTransitionRun",

  // Clipboard
  "onCopy", "onCut", "onPaste",
] as const;

type ListenerFnName = (typeof LISTENER_FNS)[number];
// TODO DOC
function makeNoopListenerBuilder(): ListenerBuilder {
  const noopSub: ListenerSub = { count: 0, ok: false, off() { /* no-op */ } };
  const onNoop = () => noopSub;

  // CHANGED: start with the option modifiers + custom hooks
  const api: ListenerBuilder = {
    on: onNoop as any,
    onCustom: onNoop as any,
    onCustomDetail: onNoop as any,

    once() { return api; },
    passive() { return api; },
    capture() { return api; },
    toWindow() { return api; },
    toDocument() { return api; },
    strict() { return api; },

    preventDefault() { return api; },
    stopProp() { return api; },
    stopImmediateProp() { return api; },
    stopAll() { return api; },
    clearStops() { return api; },
  } as ListenerBuilder;

  // CHANGED: auto-fill *every* onX convenience endpoint
  for (const k of LISTENER_FNS) {
    (api as any)[k] = onNoop;
  }

  return api;
}


/**
 * Construct a `TreeSelector` over a set of `LiveTree` instances.
 *
 * The selector:
 * - Holds an internal defensive copy of the provided trees to prevent
 *   external mutation of its backing array.
 * - Exposes iteration helpers (`toArray`, `forEach`, `map`, `count`, `at`)
 *   for inspecting the selection.
 * - Exposes broadcast mutators (`setAttrs`, `removeAttr`, `setFlags`,
 *   `removeFlags`, `setText`) that delegate to the corresponding
 *   `LiveTree` methods for each item.
 * - Exposes higher-level helpers (`style`, `css`, `data`, `listen`,
 *   `create`) that provide convenient multi-node operations.
 *
 * All broadcast mutators are side-effecting: they apply writes to each
 * member tree and then return the same `TreeSelector` instance for
 * fluent chaining. Read-oriented helpers are either pure or use a
 * "first tree as canonical" rule where explicitly documented.
 */
export function make_tree_selector(trees: LiveTree[]): TreeSelector2 {
  
const selx = new TreeSelector2(trees)
  return selx;
}

/**
 * Factory for a multi-node `DataManager2` facade over a set of trees.
 *
 * Writes:
 * - Methods like `set` and `setMulti` iterate over `items` and call
 *   the corresponding `data` method on each `LiveTree`.
 * - Return the first `LiveTree` in `items` to preserve the usual
 *   `DataManager2` chaining contract.
 *
 * Reads:
 * - Methods like `get` use `items[0]` as the canonical source of
 *   truth, e.g. `firstTree().data.get(key)`.
 *
 * If `items` is empty, attempts to read or write will throw via
 * `firstTree()` in a predictable way.
 *
 * @param items - The `LiveTree` instances whose datasets will be managed.
 * @returns A `DataManager` facade that broadcasts writes and reads
 *          from the first tree.
 * @see DataManager
 */
function makeMultiDataManager(items: LiveTree[]): DataManager {
  const firstTree = (): LiveTree => {
    const t = items[0];
    if (!t) {
      throw new Error("TreeSelector.data: empty selection");
    }
    return t;
  };

  return {
    // example assuming these exist on DataManager2:
    set(key: string, value: DatasetValue): LiveTree {
      for (const t of items) {
        t.data.set(key, value);
      }
      return firstTree();
    },

    setMany(map: DatasetObj): LiveTree {
      for (const t of items) {
        t.data.setMany(map);
      }
      return firstTree();
    },

    get(key: string): Primitive | undefined {
      // read semantics: first tree as canonical value
      return firstTree().data.get(key);
    },
  } as DataManager;
}
function makeMultiListener(items: LiveTree[]): ListenerBuilder {
  if (items.length === 0) return makeNoopListenerBuilder();

  const listeners = items.map((t) => build_listener(t));

  let multi: ListenerBuilder;

  const fanOut = (fnName: string, args: unknown[]) => {
    const subs = listeners.map((l) => {
      const fn = (l as any)[fnName];
      return typeof fn === "function" ? fn.apply(l, args) : (makeNoopListenerBuilder() as any).on();
    });
    return combineSubs(subs);
  };

  multi = {
    // CHANGED: core
    on(type, handler) {
      return fanOut("on", [type, handler]);
    },

    // CHANGED: custom hooks
    onCustom(type, handler) {
      return fanOut("onCustom", [type, handler]);
    },
    onCustomDetail(type, handler) {
      return fanOut("onCustomDetail", [type, handler]);
    },

    // CHANGED: option modifiers mutate the underlying builders then return multi
    once() { listeners.forEach((l) => l.once()); return multi; },
    passive() { listeners.forEach((l) => l.passive()); return multi; },
    capture() { listeners.forEach((l) => l.capture()); return multi; },
    toWindow() { listeners.forEach((l) => l.toWindow()); return multi; },
    toDocument() { listeners.forEach((l) => l.toDocument()); return multi; },
    strict(policy) { listeners.forEach((l) => l.strict(policy)); return multi; },

    preventDefault() { listeners.forEach((l) => l.preventDefault()); return multi; },
    stopProp() { listeners.forEach((l) => l.stopProp()); return multi; },
    stopImmediateProp() { listeners.forEach((l) => l.stopImmediateProp()); return multi; },
    stopAll() { listeners.forEach((l) => l.stopAll()); return multi; },
    clearStops() { listeners.forEach((l) => l.clearStops()); return multi; },
  } as ListenerBuilder;

  // CHANGED: auto-fill all onX convenience endpoints (onClick, onAnimationEnd, etc.)
  for (const k of LISTENER_FNS) {
    (multi as any)[k] = (...args: unknown[]) => fanOut(k, args);
  }


  return multi;
}
