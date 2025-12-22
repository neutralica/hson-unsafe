// tree-selector.ts

import { attachConvenience, ListenerBuilder, ListenerSub, MissingPolicy } from "../../types-consts/listen.types";
import { FindWithById, LiveTreeCreateHelper, TagName, TreeSelectorCreateHelper } from "../../types-consts/livetree.types";
import { css_for_quids } from "./livetree-methods/css-manager";
import { CssHandle } from "../../types-consts/css.types";
import { DataManager, DatasetObj, DatasetValue } from "./livetree-methods/data-manager";
import { build_listener } from "./livetree-methods/listen";
import { LiveTree } from "./livetree";
import { TreeSelector } from "../../types-consts/livetree.types";
import { Primitive } from "../../types-consts/core.types";
import { make_selector_create, make_tree_create } from "./livetree-methods/create-typed";
import { make_style_setter, StyleSetter } from "./livetree-methods/style-setter";
import { FindMany, FindQuery, FindQueryMany } from "./livetree-methods/find";

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

// TODO DOC
function makeNoopListenerBuilder(): ListenerBuilder {
  const noopSub: ListenerSub = { count: 0, ok: false, off() { /* no-op */ } };

  const api: ListenerBuilder = {
    on: (() => noopSub) as any,

    // CHANGED: noop onCustom is sufficient
    onCustom: (() => noopSub) as any,
    onCustomDetail: (() => noopSub) as any,

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

  return attachConvenience(api);
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
export function make_tree_selector(trees: LiveTree[]): TreeSelector {
  //  defensive copy to avoid external mutation
  const items: LiveTree[] = [...trees];
  const result: TreeSelector = {

    /**
     * Return a shallow copy of the underlying `LiveTree` array.
     *
     * This provides read-only snapshot access to the current selection
     * without exposing the internal backing array to accidental mutation.
     *
     * @returns A new array containing all `LiveTree` items in the selector.
     */
    toArray(): LiveTree[] {
      //  return a fresh copy, keep internal array private
      return [...items];
    },
    /**
     * Invoke a callback for every `LiveTree` in the selector.
     *
     * The callback receives both the `LiveTree` instance and its numeric
     * index in the current selection, mirroring `Array.prototype.forEach`.
     *
     * @param fn - Callback invoked for each tree and its index.
     */
    forEach(fn): void {
      for (let i = 0; i < items.length; i += 1) {
        fn(items[i], i);
      }
    },
    /**
     * Transform the current selection into an array of values using the
     * provided mapping function.
     *
     * This mirrors `Array.prototype.map` but operates directly on the
     * selector's internal list rather than requiring an explicit call
     * to `toArray()`.
     *
     * @typeParam T - The element type produced by the mapping function.
     * @param fn - Mapping function applied to each tree and its index.
     * @returns An array of mapped values.
     */
    map<T>(fn: (tree: LiveTree, index: number) => T): T[] {
      const out: T[] = [];
      for (let i = 0; i < items.length; i += 1) {
        out.push(fn(items[i], i));
      }
      return out;
    },
    /**
     * Return the number of `LiveTree` items in the selector.
     *
     * @returns The current selection size.
     */
    count(): number {
      return items.length;
    },
    /**
     * Retrieve the `LiveTree` at the given index, if present.
     *
     * Out-of-bounds indexes return `undefined` rather than throwing.
     *
     * @param index - Zero-based index into the selection.
     * @returns The `LiveTree` at that index, or `undefined` if out of range.
     */
    at(index: number): LiveTree | undefined {
      if (index < 0 || index >= items.length) {
        return undefined;
      }
      return items[index];
    },
    /**
     * Set one or more attributes on every `LiveTree` in this selector.
     *
     * Overloads:
     * - When `nameOrMap` is a string, forwards to `t.setAttrs(nameOrMap, value)`
     *   on each tree.
     * - When `nameOrMap` is a record, forwards to `t.setAttrs(nameOrMap)` so each
     *   tree receives all key/value pairs.
     *
     * Semantics are identical to `LiveTree.setAttrs`, applied to all selected
     * nodes. The selection itself is not changed.
     *
     * @param nameOrMap - Attribute name or map of attribute names to values.
     * @param value - Attribute value when setting a single attribute by name.
     * @returns This `TreeSelector` instance, for chaining.
     * @see LiveTree.setAttrs
     */
    setAttrs(nameOrMap: any, value?: any): TreeSelector {
      if (typeof nameOrMap === "string") {
        for (const t of items) {
          t.setAttrs(nameOrMap, value);
        }
      } else {
        for (const t of items) {
          t.setAttrs(nameOrMap);
        }
      }
      return result;
    },
    /**
     * Remove a single attribute from every `LiveTree` in this selector.
     *
     * For each tree, forwards to `t.removeAttr(name)`, which clears the
     * attribute from both HSON and DOM according to `LiveTree` semantics.
     *
     * @param name - Attribute name to remove from each selected node.
     * @returns This `TreeSelector` instance, for chaining.
     * @see LiveTree.removeAttr
     */
    removeAttr(name: string): TreeSelector {
      for (const t of items) {
        t.removeAttr(name);
      }
      return result;
    },
    /**
     * Set one or more boolean-present attributes ("flags") on every
     * `LiveTree` in this selector.
     *
     * For each tree, forwards to `t.setFlags(...names)`, so that each named
     * attribute is present and treated as a flag on all selected nodes.
     *
     * @param names - One or more attribute names to set as flags.
     * @returns This `TreeSelector` instance, for chaining.
     * @see LiveTree.setFlags
     */
    setFlags(...names: string[]): TreeSelector {
      items.forEach(tree => tree.setFlags(...names));
      return result;
    },
    /**
     * Set one or more boolean-present attributes ("flags") on every
     * `LiveTree` in this selector.
     *
     * For each tree, forwards to `t.setFlags(...names)`, so that each named
     * attribute is present and treated as a flag on all selected nodes.
     *
     * @param names - One or more attribute names to set as flags.
     * @returns This `TreeSelector` instance, for chaining.
     * @see LiveTree.setFlags
     */
    removeFlags(...names: string[]): TreeSelector {
      for (const t of items) {
        t.removeFlags(...names);
      }
      return result;
    },

    // --- style: broadcast wrapper over first.style ---
    /**
     * Multi-node style manager for the current selection.
     *
     * Behavior:
     * - Throws if the selection is empty, since there is no canonical
     *   element to read style state from.
     * - Uses the first `LiveTree` in the selection as the canonical source
     *   of style state and as the base `StyleManager2` surface.
     * - Returns a proxy object that:
     *   - Inherits all methods/props from the first tree's `style`.
     *   - Overrides `setMulti` to broadcast the given style block to all
     *     trees in the selection, while preserving the original return
     *     contract (a `LiveTree` from the first item).
     *
     * Reads behave as if calling `.style` on the first tree; writes via
     * `setMulti` are applied to every selected tree.
     *
     * @returns A `StyleManager2`-compatible proxy for the selection.
     * @see StyleManager
     */
    get style(): StyleSetter {
      const first = items[0];
      if (!first) {
        throw new Error("[TreeSelector.style] no items in selector");
      }

      // broadcast adapter — apply/remove/clear fan out to all items
      const adapters = {
        apply: (propCanon: string, value: string) => {
          for (const t of items) {
            t.style.setProp(propCanon, value);
          }
        },

        remove: (propCanon: string) => {
          for (const t of items) {
            t.style.remove(propCanon);
          }
        },

        clear: () => {
          for (const t of items) {
            t.style.clear();
          }
        },
      } satisfies Parameters<typeof make_style_setter>[0]; // optional if you have that type accessible

      return make_style_setter(adapters);
    },
    /**
     * QUID-scoped stylesheet handle for the current selection.
     *
     * Behavior:
     * - When the selection is empty, returns a safe no-op `CssHandle`
     *   by calling `css_for_quids([])`.
     * - Otherwise, collects `tree.quid` for each `LiveTree` (ignoring
     *   falsy values) and calls `css_for_quids(quids)` to produce a
     *   combined handle for all selected nodes.
     *
     * The resulting handle can be used to manage styles keyed by the
     * QUIDs of all trees in the selection.
     *
     * @returns A `CssHandle` that targets all QUIDs in the selection, or a
     *          no-op handle when empty.
     * @see css_for_quids
     */
    get css(): CssHandle {
      // empty selection → safe no-op handle
      if (items.length === 0) {
        return css_for_quids([]);
      }

      const quids: string[] = [];
      for (const tree of items) {
        const q = tree.quid;      // assumes LiveTree2 has a `quid` getter
        if (q) quids.push(q);
      }
      return css_for_quids(quids);
    },
    /**
     * Multi-node dataset manager for the current selection.
     *
     * The returned `DataManager2` facade:
     * - Broadcasts write operations such as `set` and `setMulti` to the
     *   `.data` manager of each tree in `items`, then returns the first
     *   `LiveTree` in the list to preserve `DataManager2`'s chaining model.
     * - Implements read operations such as `get` by querying only the
     *   first tree, treating its dataset as canonical for the selection.
     *
     * When the selection is empty, read and write operations throw in the
     * same way they would if `.data` were accessed on a non-existent
     * `LiveTree`.
     *
     * @returns A `DataManager2` facade that fans operations out to all
     *          selected trees.
     * @see DataManager
     * @see makeMultiDataManager
     */
    get data(): DataManager {
      return makeMultiDataManager(items);
    },
    /**
     * Multi-node event listener builder for the current selection.
     *
     * Behavior:
     * - When the selection is empty, returns a fully-typed no-op
     *   `ListenerBuilder` where:
     *   - All configuration methods chain and do nothing.
     *   - `attach()` returns a `ListenerSub` with `count = 0`, `ok = false`,
     *     and a no-op `off()`.
     * - When the selection is non-empty:
     *   - Creates one real `ListenerBuilder` per `LiveTree` via
     *     `buildListener(tree)`.
     *   - Returns a composite `ListenerBuilder` whose methods fan out to
     *     each underlying builder and then return the composite for chaining.
     *   - `attach()` aggregates underlying `ListenerSub` objects into a
     *     single `ListenerSub` whose `count` is the sum of all counts and
     *     whose `off()` tears down all underlying subscriptions.
     *
     * This allows identical listener configuration to be applied to all
     * selected nodes through a single fluent API.
     *
     * @returns A `ListenerBuilder` that targets all trees in the selection.
     * @see ListenerBuilder
     * @see build_listener
     * @see makeMultiListener
     */
    get listen(): ListenerBuilder {
      return makeMultiListener(items);
    },
    /**
     * Creation helper for the current selection, providing the same surface
     * API as `LiveTree.create` but broadcasting across all `LiveTree` items
     * and returning a new `TreeSelector` of the created children.
     *
     * Behavior:
     * - Per-tag methods (e.g. `selector.create.div(index?)`):
     *   - For each tree in the selection, call `tree.create.div(index?)`.
     *   - Collect all returned children into a flattened `TreeSelector`.
     * - Batch method (`selector.create.tags([...], index?)`):
     *   - For each tree, call `tree.create.tags([...], index?)`.
     *   - Flatten all created children into a single `TreeSelector`.
     *
     * The original selection is not modified; each `create` call produces
     * a new selection representing only the newly created nodes.
     *
     * @returns A `TreeSelectorCreateHelper` scoped to the current selection.
     * @see TreeSelectorCreateHelper
     * @see LiveTreeCreateHelper
     * @see make_selector_create
     */
    get create(): TreeSelectorCreateHelper {
      return make_selector_create(items);
    },
    /**
     * Set the text content of every `LiveTree` in this selector.
     *
     * Semantics:
     * - Iterates over the internal list of trees and calls `t.setText(value)`
     *   on each one, so each selected node is updated via the same HSON +
     *   DOM sync path as a single-tree call.
     * - The selection itself is not  after this call, the selector
     *   still refers to the same `LiveTree` instances, now with updated text.
     *
     * This is a broadcast side-effect: it performs a write operation on
     * each subtree and then returns the same selector for further chaining.
     *
     * @param value - The primitive text value to apply to each selected node.
     * @returns This `TreeSelector` instance, for chaining.
     * @see LiveTree.setText 
     */
    setText(value: Primitive): TreeSelector {
      for (const t of items) {
        t.setText(value);
      }
      return result;
    },
    find: (() => {
      const base = ((q: FindQuery): LiveTree | undefined => {
        for (const t of items) {
          const hit = t.find(q);
          if (hit) return hit;
        }
        return undefined;
      }) as FindWithById;

      const mustBase = ((q: FindQuery, label?: string): LiveTree => {
        const hit = base(q);
        if (!hit) {
          const desc = label ?? (typeof q === "string" ? q : JSON.stringify(q));
          throw new Error(`[TreeSelector.find.must] expected match for ${desc}`);
        }
        return hit;
      }) as FindWithById["must"];

      base.byId = (id: string) => base({ attrs: { id } });
      base.byAttrs = (attr: string, value: string) => base({ attrs: { [attr]: value } });
      base.byFlags = (flag: string) => base({ attrs: { [flag]: flag } });
      base.byTag = (tag: string) => base({ tag });

      mustBase.byId = (id: string) => mustBase({ attrs: { id } });
      mustBase.byAttrs = (attr: string, value: string) => mustBase({ attrs: { [attr]: value } });
      mustBase.byFlags = (flag: string) => mustBase({ attrs: { [flag]: flag } });
      mustBase.byTag = (tag: string) => mustBase({ tag });

      base.must = mustBase;

      return base;
    })(),

    // ADDED: findAll (function-object with helpers)
    findAll: (() => {
      const base = ((q: FindQueryMany): TreeSelector => {
        const out: LiveTree[] = [];
        for (const t of items) {
          out.push(...t.findAll(q).toArray());
        }
        return make_tree_selector(out);
      }) as FindMany;

      const mustBase = ((q: FindQueryMany, label?: string): TreeSelector => {
        const sel = base(q);
        if (sel.count() === 0) {
          const desc = label ?? "query";
          throw new Error(`[TreeSelector.findAll.must] expected >=1 match for ${desc}`);
        }
        return sel;
      }) as FindMany["must"];

      base.id = (ids: string | readonly string[]): TreeSelector => {
        const list: readonly string[] = Array.isArray(ids) ? ids : [ids];
        return base(list.map((id) => ({ attrs: { id } })));
      };

      base.byAttribute = (attr: string, value: string): TreeSelector =>
        base({ attrs: { [attr]: value } });

      base.byFlag = (flag: string): TreeSelector =>
        base({ attrs: { [flag]: flag } });

      base.byTag = (tag: string): TreeSelector =>
        base({ tag });

      mustBase.id = (ids: string | readonly string[]): TreeSelector => {
        const list: readonly string[] = Array.isArray(ids) ? ids : [ids];
        return mustBase(list.map((id) => ({ attrs: { id } })));
      };

      mustBase.byAttribute = (attr: string, value: string): TreeSelector =>
        mustBase({ attrs: { [attr]: value } });

      mustBase.byFlag = (flag: string): TreeSelector =>
        mustBase({ attrs: { [flag]: flag } });

      mustBase.byTag = (tag: string): TreeSelector =>
        mustBase({ tag });

      base.must = mustBase;

      return base;
    })(),
  };

  return result;
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
/**
 * Factory for a composite `ListenerBuilder` over a set of `LiveTree`
 * instances.
 *
 * - If `items` is empty:
 *   - Returns a no-op builder where all methods return the same builder
 *     and `attach()` returns a `ListenerSub` with `count = 0`,
 *     `ok = false`, and a no-op `off()`.
 *
 * - If `items` is non-empty:
 *   - Constructs one real `ListenerBuilder` per tree via `buildListener`.
 *   - Returns a multi-builder whose methods:
 *     - Call the corresponding method on each underlying builder.
 *     - Return the multi-builder itself for fluent chaining.
 *   - Provides an `attach()` that:
 *     - Calls `attach()` on each underlying builder.
 *     - Sums their `count` fields.
 *     - Returns a `ListenerSub` whose `off()` calls `off()` on each
 *       underlying subscription.
 *
 * This abstraction lets you configure and attach listeners across many
 * nodes with a single builder chain.
 *
 * @param items - The `LiveTree` instances whose listeners will be
 *                managed together.
 * @returns A composite `ListenerBuilder` spanning all trees in `items`.
 * @see ListenerBuilder
 * @see build_listener
 */
function makeMultiListener(items: LiveTree[]): ListenerBuilder {
  if (items.length === 0) return makeNoopListenerBuilder();

  const listeners = items.map(tree => build_listener(tree));

  let multi: ListenerBuilder;

  multi = {
    // CHANGED: base primitive
    on(type, handler) {
      const subs = listeners.map(l => l.on(type, handler));
      return combineSubs(subs);
    },

    // CHANGED: implement onCustom once and let convenience layer derive everything
    onCustom(type, handler) {
      const subs = listeners.map(l => l.onCustom(type, handler));
      return combineSubs(subs);
    },

    onCustomDetail(type, handler) {
      const subs = listeners.map(l => l.onCustomDetail(type, handler));
      return combineSubs(subs);
    },

    // options: mutate underlying builders and return this one
    once() { listeners.forEach(l => l.once()); return multi; },
    passive() { listeners.forEach(l => l.passive()); return multi; },
    capture() { listeners.forEach(l => l.capture()); return multi; },
    toWindow() { listeners.forEach(l => l.toWindow()); return multi; },
    toDocument() { listeners.forEach(l => l.toDocument()); return multi; },

    strict(policy) { listeners.forEach(l => l.strict(policy)); return multi; },

    preventDefault() { listeners.forEach(l => l.preventDefault()); return multi; },
    stopProp() { listeners.forEach(l => l.stopProp()); return multi; },
    stopImmediateProp() { listeners.forEach(l => l.stopImmediateProp()); return multi; },
    stopAll() { listeners.forEach(l => l.stopAll()); return multi; },
    clearStops() { listeners.forEach(l => l.clearStops()); return multi; },
  } as ListenerBuilder;

  // ADDED: fill in onClick/onAnimationEnd/etc in terms of onCustom
  return attachConvenience(multi);


}
