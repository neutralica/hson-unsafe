// liveTree.listen.ts — minimal, typed, GC-safe listener builder

import { LiveTree } from "../live-tree-class.new.tree";

// — Typed DOM event map (HTMLElement scope is usually what you want)
type EMap = HTMLElementEventMap;

// — Options object we’ll use (mirrors addEventListener options)
export type ListenOpts = {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  // scope switchers (v1 keeps it simple; default is element)
  target?: "element" | "window" | "document";
};

// — Subscription handle you can store and later call off()
export interface ListenerSub {
  off(): void;
}

// — Builder surface returned by tree.listen
export interface ListenerBuilder {
  // on('click', ...) generic
  on<K extends keyof EMap>(type: K, handler: (ev: EMap[K]) => void): ListenerBuilder;
  // common sugars (typed)
  onClick(handler: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseMove(handler: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseDown(handler: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseUp(handler: (ev: MouseEvent) => void): ListenerBuilder;
  onKeyDown(handler: (ev: KeyboardEvent) => void): ListenerBuilder;
  onKeyUp(handler: (ev: KeyboardEvent) => void): ListenerBuilder;

  // option toggles (chainable)
  once(): ListenerBuilder;
  passive(): ListenerBuilder;
  capture(): ListenerBuilder;
  toWindow(): ListenerBuilder;
  toDocument(): ListenerBuilder;

  // apply to each node in selection (default is first)
  onEach(): ListenerBuilder;

  // attach now; returns a composite subscription (batch off)
  attach(): ListenerSub;
}

// — Internal registry to track listeners per element for cleanup
const REG = new WeakMap<EventTarget, Set<() => void>>();

// — Small helper to add + remember an off() for GC hygiene
function addWithOff(
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  opts: AddEventListenerOptions
): () => void {
  target.addEventListener(type, handler, opts);
  const off = () => target.removeEventListener(type, handler, opts);
  const set = REG.get(target) ?? new Set<() => void>();
  set.add(off);
  REG.set(target, set);
  return off;
}

// — Allow LiveTree to call this when it removes nodes (hook in your remove path)
export function _listeners_off_for_target(target: EventTarget): void {
  const set = REG.get(target);
  if (!set) return;
  for (const off of set) off();
  REG.delete(target);
}

// — Factory to make a builder bound to a LiveTree selection
export function makeListenerBuilder(tree: LiveTree): ListenerBuilder {
  // capture current selection lazily (we’ll resolve elements at attach time)
  let opts: ListenOpts = {};
  let each = false;

  // queued entries to attach on .attach()
  type Q = { type: keyof EMap | string; handler: EventListener; };
  const queue: Q[] = [];

  // resolve event target per element based on opts.target
  const resolveTarget = (el: HTMLElement): EventTarget => {
    if (opts.target === "window") return window;
    if (opts.target === "document") return document;
    return el;
  };

  // push typed handlers into the queue
  const on = <K extends keyof EMap>(type: K, handler: (ev: EMap[K]) => void): ListenerBuilder => {
    const h: EventListener = (e) => handler(e as EMap[K]);
    queue.push({ type, handler: h });
    return api;
  };

  // batch attach all queued entries, return composite off
  const attach = (): ListenerSub => {
    // find elements: either first match or every node in selection
    const targets: HTMLElement[] = [];
    if (each) {
      // iterate every node in current selection; asDomElement() per node
      // If you have a direct enumerator, use it; fallback: findAll('*') under tree then filter to roots is also fine.
      const all = tree.findAll({}); // your API returns all under selection; adjust if needed
      const n = all.count();
      for (let i = 0; i < n; i++) {
        const el = all.at(i).asDomElement(); // first element of that sub-selection
        if (el) targets.push(el);
      }
    } else {
      const el = tree.asDomElement();
      if (el) targets.push(el);
    }

    // build final options bag for addEventListener
    const aelo: AddEventListenerOptions = {
      capture: !!opts.capture,
      once: !!opts.once,
      passive: !!opts.passive,
    };

    // attach all and collect off()s
    const offs: Array<() => void> = [];
    for (const el of targets) {
      const tgt = resolveTarget(el);
      for (const q of queue) {
        const off = addWithOff(tgt, q.type, q.handler, aelo);
        offs.push(off);
      }
    }

    // composite off handle
    return { off: () => { for (const f of offs) f(); } };
  };

  // chainable API
  const api: ListenerBuilder = {
    on,
    onClick:       (fn) => on("click", fn),
    onMouseMove:   (fn) => on("mousemove", fn),
    onMouseDown:   (fn) => on("mousedown", fn),
    onMouseUp:     (fn) => on("mouseup", fn),
    onKeyDown:     (fn) => on("keydown", fn),
    onKeyUp:       (fn) => on("keyup", fn),

    once:          () => { opts = { ...opts, once: true }; return api; },
    passive:       () => { opts = { ...opts, passive: true }; return api; },
    capture:       () => { opts = { ...opts, capture: true }; return api; },
    toWindow:      () => { opts = { ...opts, target: "window" }; return api; },
    toDocument:    () => { opts = { ...opts, target: "document" }; return api; },

    onEach:        () => { each = true; return api; },
    attach,
  };

  return api;
}

/* ──────────────────────────────────────────────────────────────────────────
   LiveTree integration points (add to your LiveTree prototype/adapter)
────────────────────────────────────────────────────────────────────────── */

// add a property or method on LiveTree to create a builder
// tree.listen.onClick(...).once().attach();
// Object.defineProperty(LiveTree.prototype, "listen", {
//   get: function () { return makeListenerBuilder(this as LiveTree); }
// });

// call _listeners_off_for_target(el) when LiveTree physically removes a node
// in your internal remove() / detach() implementation:
//   const el = map.get(node);
//   if (el) _listeners_off_for_target(el);
//   el.remove();
