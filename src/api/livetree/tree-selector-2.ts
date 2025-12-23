// TreeSelector2.ts
// NOTE: This is written to be drop-in friendly in your codebase.
// - It avoids “rebuilding” manager types by *broadcasting* calls through a Proxy.
// - It keeps the public surface strongly typed by deriving types from LiveTree itself.

import { LiveTree } from "./livetree";

// import type { LiveTree } from "../livetree";                 // <-- adjust
// import type { ListenerBuilder } from "./listen.types";       // <-- adjust
// import { makeMultiListener } from "./tree-selector.listen";  // <-- adjust

type LiveTreeStyle = LiveTree["style"];
type LiveTreeCss = LiveTree["css"];
type LiveTreeListen = LiveTree["listen"];

/**
 * Keep this interface in the same module as TreeSelector2 so it stays honest.
 * Derive types from LiveTree so you don’t have to mirror “manager” signatures here.
 */
export interface TreeSelectorType {
  toArray(): LiveTree[];
  count(): number;
  first(): LiveTree | undefined;

  forEach(fn: (tree: LiveTree, index: number) => void): void;
  map<T>(fn: (tree: LiveTree, index: number) => T): T[];
  filter(fn: (tree: LiveTree, index: number) => boolean): TreeSelector2;

  removeSelf(): number;
  remove(): number;

  readonly listen: LiveTreeListen; // ListenerBuilder-like; matches your existing `tree.listen`
  readonly style: LiveTreeStyle;
  readonly css: LiveTreeCss;

  // If your LiveTree uses `dataset` instead of `data`, change this line to match.
  readonly data: LiveTree["data"];
}

/**
 * Broadcast helper:
 * Creates a proxy that forwards any method call to *each* selected LiveTree’s manager.
 *
 * Example: selector.style.setMany({ ... }) calls tree.style.setMany(...) for every tree.
 */
function makeBroadcastProxy<T extends object>(
  items: readonly LiveTree[],
  pick: (t: LiveTree) => T,
): T {
  // We need a concrete object target for Proxy; the first item’s manager works fine.
  const base: T | undefined = items[0] ? pick(items[0]) : undefined;

  // Empty selection: return a no-op proxy that safely absorbs calls.
  if (!base) {
    const noop = new Proxy(
      {},
      {
        get() {
          return () => undefined;
        },
      },
    );
    // TS can’t infer Proxy shape; this is one contained cast.
    return noop as unknown as T; // CHANGED: isolated cast (no spreading `as` all over user code)
  }

  const proxy = new Proxy(base, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);

      // Pass through non-functions (properties, getters, etc.)
      if (typeof v !== "function") return v;

      // Broadcast function calls across all items
      return (...args: unknown[]) => {
        let last: unknown = undefined;

        for (let i = 0; i < items.length; i += 1) {
          const mgr = pick(items[i]);
          const fn = (mgr as unknown as Record<PropertyKey, unknown>)[prop];

          if (typeof fn === "function") {
            last = (fn as (...xs: unknown[]) => unknown).apply(mgr, args);
          }
        }

        // Return the last manager’s return value (usually ignored, but keeps behavior predictable)
        return last;
      };
    },
  });

  return proxy as unknown as T; // CHANGED: isolated cast
}

export class TreeSelector2 implements TreeSelectorType {
  private readonly items: LiveTree[];

  public readonly listen: LiveTreeListen;
  public readonly style: LiveTreeStyle;
  public readonly css: LiveTreeCss;
  public readonly data: LiveTree["data"];

  public constructor(trees: LiveTree[]) {
    // Defensive copy to avoid external mutation.
    this.items = [...trees];

    // Broadcast proxies.
    // If you already have a dedicated makeMultiListener(items), you can swap this line.
    this.listen = makeBroadcastProxy(this.items, (t) => t.listen);

    this.style = makeBroadcastProxy(this.items, (t) => t.style);
    this.css = makeBroadcastProxy(this.items, (t) => t.css);

    // If your LiveTree uses `dataset` not `data`, change to (t) => t.dataset
    this.data = makeBroadcastProxy(this.items, (t) => t.data);
  }

  public toArray(): LiveTree[] {
    return [...this.items];
  }

  public count(): number {
    return this.items.length;
  }

  public first(): LiveTree | undefined {
    return this.items[0];
  }

  public forEach(fn: (tree: LiveTree, index: number) => void): void {
    for (let i = 0; i < this.items.length; i += 1) fn(this.items[i], i);
  }

  public map<T>(fn: (tree: LiveTree, index: number) => T): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.items.length; i += 1) out.push(fn(this.items[i], i));
    return out;
  }

  public filter(fn: (tree: LiveTree, index: number) => boolean): TreeSelector2 {
    const next: LiveTree[] = [];
    for (let i = 0; i < this.items.length; i += 1) {
      if (fn(this.items[i], i)) next.push(this.items[i]);
    }
    return new TreeSelector2(next);
  }

  public removeSelf(): number {
    let n = 0;

    for (let i = 0; i < this.items.length; i += 1) {
      const t = this.items[i] as unknown as { removeSelf?: () => unknown; remove?: () => unknown };

      // Prefer your explicit method if it exists.
      if (typeof t.removeSelf === "function") {
        t.removeSelf();
        n += 1;
        continue;
      }

      if (typeof t.remove === "function") {
        t.remove();
        n += 1;
      }
    }

    return n;
  }

  public remove(): number {
    return this.removeSelf();
  }
}