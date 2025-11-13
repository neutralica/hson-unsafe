// listen.ts — v2 with auto-attach + validation

import { LiveTree } from "../live-tree-class.new.tree";

type EMap = HTMLElementEventMap;

export type ListenOpts = {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  target?: "element" | "window" | "document";
};

export type MissingPolicy = "ignore" | "warn" | "throw";

export interface ListenerSub {
  off(): void;
  /** number of concrete EventTarget attachments performed */
  count: number;
  /** true iff count > 0 */
  ok: boolean;
}

export interface ListenerBuilder {
  // typed events
  on<K extends keyof EMap>(type: K, handler: (ev: EMap[K]) => void): ListenerBuilder;
  onClick(h: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseMove(h: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseDown(h: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseUp(h: (ev: MouseEvent) => void): ListenerBuilder;
  onKeyDown(h: (ev: KeyboardEvent) => void): ListenerBuilder;
  onKeyUp(h: (ev: KeyboardEvent) => void): ListenerBuilder;

  // options
  once(): ListenerBuilder;
  passive(): ListenerBuilder;
  capture(): ListenerBuilder;
  toWindow(): ListenerBuilder;
  toDocument(): ListenerBuilder;
  onEach(): ListenerBuilder;

  // validation / scheduling
  strict(policy?: MissingPolicy): ListenerBuilder; // default "warn"
  defer(): ListenerBuilder;                        // cancel auto-attach for manual attach()

  // explicit attach (returns handle). Auto-attach will also return a handle.
  attach(): ListenerSub;
  preventDefault(): ListenerBuilder;
  stopProp(): ListenerBuilder;
  stopImmediateProp(): ListenerBuilder;
  stopAll(): ListenerBuilder;
  clearStops(): ListenerBuilder;
}

const REG = new WeakMap<EventTarget, Set<() => void>>();

function addWithOff(
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  opts: AddEventListenerOptions
): () => void {
  target.addEventListener(type, handler, opts);
  const off = () => target.removeEventListener(type, handler, opts);
  let set = REG.get(target);
  if (!set) { set = new Set(); REG.set(target, set); }
  set.add(off);
  return off;
}

export function _listeners_off_for_target(target: EventTarget): void {
  const set = REG.get(target);
  if (!set) return;
  for (const off of set) off();
  REG.delete(target);
}

export function makeListenerBuilder(tree: LiveTree): ListenerBuilder {
  type Q = { type: string; handler: EventListener };
  const queue: Q[] = [];

  let opts: ListenOpts = {};
  let each = false;
  let missingPolicy: MissingPolicy = "warn";
  let _prevent = false;
  let _stop = false;
  let _stopImmediate = false;

  // auto-attach scheduling
  let scheduled = false;
  let autoEnabled = true;
  let lastHandle: ListenerSub | null = null;

  const schedule = () => {
    if (!autoEnabled || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!autoEnabled) return;
      lastHandle = attach(); // performs real attach
    });
  };

  const resolveTarget = (el: HTMLElement): EventTarget =>
    opts.target === "window" ? window :
      opts.target === "document" ? document :
        el;

  const collectTargets = (): HTMLElement[] => {
    if (!each) {
      const el = tree.asDomElement();
      return el ? [el] : [];
    }
    // iterate all nodes in current selection
    const out: HTMLElement[] = [];
    const all = tree.findAll({}); // your selection-wide enumerator
    const n = all.count();
    for (let i = 0; i < n; i++) {
      const el = all.at(i).asDomElement();
      if (el) out.push(el);
    }
    return out;
  };
  const on = <K extends keyof EMap>(
    type: K,
    handler: (ev: EMap[K]) => void
  ): ListenerBuilder => {
    // wrap once, read flags at dispatch so end-of-chain calls work
    const wrapped: EventListener = (ev: Event) => {
      // enforce in this exact order
      if (_stopImmediate) ev.stopImmediatePropagation();
      if (_stop) ev.stopPropagation();
      if (_prevent && !opts.passive) ev.preventDefault(); // passive forbids preventDefault()

      handler(ev as EMap[K]);

      // optional: belt-and-suspenders once — harmless if DOM once already removed it
      if (opts.once) {
        const tgt =
          opts.target === "window" ? window :
            opts.target === "document" ? document :
              // same element resolved at attach time via resolveTarget(); this is for safety
              (ev.currentTarget as EventTarget | null) ?? document;
        tgt.removeEventListener(String(type), wrapped, { capture: !!opts.capture });
      }
    };

    // queue this binding; attach() will call addEventListener with your current opts
    queue.push({ type: String(type), handler: wrapped });
    schedule(); // auto-attach at end of microtask
    return api;
  };
  const attach = (): ListenerSub => {
    const targets = collectTargets();

    if (targets.length === 0) {
      const msg = `listen.attach(): no targets in selection`;
      if (missingPolicy === "throw") throw new Error(msg);
      if (missingPolicy === "warn") console.warn(msg, { tree });
      return { off: () => void 0, count: 0, ok: false };
    }

    const aelo: AddEventListenerOptions = {
      capture: !!opts.capture,
      once: !!opts.once,
      passive: !!opts.passive,
    };

    const offs: Array<() => void> = [];
    for (const el of targets) {
      const tgt = resolveTarget(el);
      for (const q of queue) {
        offs.push(addWithOff(tgt, q.type, q.handler, aelo));
      }
    }
    const handle: ListenerSub = {
      off: () => { for (const f of offs) f(); },
      count: offs.length,
      ok: offs.length > 0,
    };
    return handle;
  };

  const api: ListenerBuilder = {
    on,
    onClick: (fn) => on("click", fn),
    onMouseMove: (fn) => on("mousemove", fn),
    onMouseDown: (fn) => on("mousedown", fn),
    onMouseUp: (fn) => on("mouseup", fn),
    onKeyDown: (fn) => on("keydown", fn),
    onKeyUp: (fn) => on("keyup", fn),

    once: () => { opts = { ...opts, once: true }; return api; },
    passive: () => { opts = { ...opts, passive: true }; return api; },
    capture: () => { opts = { ...opts, capture: true }; return api; },
    toWindow: () => { opts = { ...opts, target: "window" }; return api; },
    toDocument: () => { opts = { ...opts, target: "document" }; return api; },
    onEach: () => { each = true; return api; },

    strict(policy: MissingPolicy = "warn") { missingPolicy = policy; return api; },
    defer() { autoEnabled = false; return api; },

    attach() { autoEnabled = false; return attach(); },
    preventDefault(): ListenerBuilder { _prevent = true; return api; },
    stopProp(): ListenerBuilder { _stop = true; return api; },
    stopImmediateProp(): ListenerBuilder { _stopImmediate = true; return api; },
    stopAll(): ListenerBuilder { _stopImmediate = _stop = _prevent = true; return api; },
    clearStops(): ListenerBuilder { _stopImmediate = _stop = _prevent = false; return api; }
  };

  return api;
}
