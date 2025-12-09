// // listen.ts

// import { LiveTree } from "../live-tree-class.tree";
// import { ListenerBuilder, ListenOpts, MissingPolicy, ListenerSub, EMap } from "../../../types-consts/listen.types";

// /**
//  * Internal registry mapping EventTargets → Sets of "off" callbacks.
//  *
//  * LiveTree uses this to provide reliable teardown for any listeners it creates.
//  * Each target holds a Set of functions that, when called, remove exactly the
//  * listener that was added. This allows bulk-cleanup without needing to track
//  * the original handlers or options externally.
//  */
// const REG = new WeakMap<EventTarget, Set<() => void>>();


// /**
//  * Adds an event listener and returns an `off()` function that removes it.
//  *
//  * The returned callback is stored in a WeakMap registry keyed by the target.
//  * This enables:
//  *   • one-shot detaching of a specific listener (`off()`),
//  *   • or grouped teardown of *all* listeners for a target
//  *     via `_listeners_off_for_target()`.
//  *
//  * The target → off-callbacks relationship is ephemeral and garbage-collectable
//  * because the registry uses a WeakMap.
//  *
//  * @param target - The DOM EventTarget to attach to.
//  * @param type - Event type (e.g. `"click"`).
//  * @param handler - Listener function or object.
//  * @param opts - Standard `addEventListener` options.
//  * @returns A function that removes the registered listener.
//  */
// function addWithOff(
//   target: EventTarget,
//   type: string,
//   handler: EventListenerOrEventListenerObject,
//   opts: AddEventListenerOptions
// ): () => void {
//   target.addEventListener(type, handler, opts);
//   const off = () => target.removeEventListener(type, handler, opts);
//   let set = REG.get(target);
//   if (!set) { set = new Set(); REG.set(target, set); }
//   set.add(off);
//   return off;
// }

// /**
//  * Removes *all* listeners previously attached to a target via `addWithOff()`.
//  *
//  * This walks the stored off-callbacks for the given target, calls each one,
//  * and then clears the registry entry. If the target has no registered
//  * listeners, the function does nothing.
//  *
//  * This is the internal mechanism LiveTree uses when:
//  *   • cleaning up listeners during node removal,
//  *   • re-grafting,
//  *   • or explicitly flushing listeners created by the `.listen` builder.
//  *
//  * @param target - The EventTarget whose listeners should be removed.
//  */
// export function _listeners_off_for_target(target: EventTarget): void {
//   const set = REG.get(target);
//   if (!set) return;
//   for (const off of set) off();
//   REG.delete(target);
// }

// /**
//  * Constructs a ListenerBuilder for a given LiveTree selection.
//  *
//  * The builder accumulates listener declarations (event type, handler,
//  * options) and attaches them either:
//  *   - automatically in a microtask (default), or
//  *   - manually via `.attach()`.
//  *
//  * Implementation details:
//  * - `queue`: holds pending listener specs until attachment.
//  * - `opts`: per-listener options (`{ capture, once, passive }`, etc.).
//  * - prevent / stop / stopImmediate: convenience flags that wrap the
//  *   handler to call `preventDefault()`, `stopPropagation()`,
//  *   or `stopImmediatePropagation()`.
//  * - Listeners always resolve their DOM targets lazily using the LiveTree’s
//  *   current selection and QUID → Element mapping.
//  * - `missingPolicy`: controls what happens if a selected node is not yet
//  *   mounted in the DOM (`'ignore' | 'warn' | 'throw'`).
//  *
//  * Returns a fluent API for describing one or many listeners and then
//  * attaching them in a controlled, predictable way.
//  */
// export function makeListenerBuilder(tree: LiveTree): ListenerBuilder {
//   type Q = { type: string; handler: EventListener };
//   const queue: Q[] = [];

//   let opts: ListenOpts = {};
//   let each = false;
//   let missingPolicy: MissingPolicy = "warn";
//   let _prevent = false;
//   let _stop = false;
//   let _stopImmediate = false;

//   // auto-attach scheduling
//   let scheduled = false;
//   let autoEnabled = true;
//   let lastHandle: ListenerSub | null = null;

//   const schedule = () => {
//     if (!autoEnabled || scheduled) return;
//     scheduled = true;
//     queueMicrotask(() => {
//       scheduled = false;
//       if (!autoEnabled) return;
//       lastHandle = attach(); // performs real attach
//     });
//   };

//   const resolveTarget = (el: Element): EventTarget =>
//     opts.target === "window" ? window :
//       opts.target === "document" ? document :
//         el;

//   const collectTargets = (): Element[] => {
//     if (!each) {
//       const el = tree.asDomElement();
//       return el ? [el] : [];
//     }
//     // iterate all nodes in current selection
//     const out: Element[] = [];
//     const all = tree.findAll({}); // selection-wide enumerator
//     const n = all.count();
//     for (let i = 0; i < n; i++) {
//       const atIndex = all.at(i);
//       if (!atIndex) { continue }
//       const el = atIndex.asDomElement();
//       if (el) out.push(el);
//     }
//     return out;
//   };
//   const on = <K extends keyof EMap>(
//     type: K,
//     handler: (ev: EMap[K]) => void
//   ): ListenerBuilder => {
//     // wrap once, read flags at dispatch so end-of-chain calls work
//     const wrapped: EventListener = (ev: Event) => {
//       // enforce in this exact order
//       if (_stopImmediate) ev.stopImmediatePropagation();
//       if (_stop) ev.stopPropagation();
//       if (_prevent && !opts.passive) ev.preventDefault(); // passive forbids preventDefault()

//       handler(ev as EMap[K]);

//       // optional: belt-and-suspenders once — harmless if DOM once already removed it
//       if (opts.once) {
//         const tgt =
//           opts.target === "window" ? window :
//             opts.target === "document" ? document :
//               // same element resolved at attach time via resolveTarget(); this is for safety
//               (ev.currentTarget as EventTarget | null) ?? document;
//         tgt.removeEventListener(String(type), wrapped, { capture: !!opts.capture });
//       }
//     };

//     // queue this binding; attach() will call addEventListener with current opts
//     queue.push({ type: String(type), handler: wrapped });
//     schedule(); // auto-attach at end of microtask
//     return api;
//   };
//   const attach = (): ListenerSub => {
//     const targets = collectTargets();

//     if (targets.length === 0) {
//       const msg = `listen.attach(): no targets in selection`;
//       if (missingPolicy === "throw") throw new Error(msg);
//       if (missingPolicy === "warn") console.warn(msg, { tree });
//       return { off: () => void 0, count: 0, ok: false };
//     }

//     const aelo: AddEventListenerOptions = {
//       capture: !!opts.capture,
//       once: !!opts.once,
//       passive: !!opts.passive,
//     };

//     const offs: Array<() => void> = [];
//     for (const el of targets) {
//       const tgt = resolveTarget(el);
//       for (const q of queue) {
//         offs.push(addWithOff(tgt, q.type, q.handler, aelo));
//       }
//     }
//     const handle: ListenerSub = {
//       off: () => { for (const f of offs) f(); },
//       count: offs.length,
//       ok: offs.length > 0,
//     };
//     return handle;
//   };

//   const api: ListenerBuilder = {
//     on,
//     onClick: (fn) => on("click", fn),
//     onMouseMove: (fn) => on("mousemove", fn),
//     onMouseDown: (fn) => on("mousedown", fn),
//     onMouseUp: (fn) => on("mouseup", fn),
//     onKeyDown: (fn) => on("keydown", fn),
//     onKeyUp: (fn) => on("keyup", fn),

//     once: () => { opts = { ...opts, once: true }; return api; },
//     passive: () => { opts = { ...opts, passive: true }; return api; },
//     capture: () => { opts = { ...opts, capture: true }; return api; },
//     toWindow: () => { opts = { ...opts, target: "window" }; return api; },
//     toDocument: () => { opts = { ...opts, target: "document" }; return api; },
//     onEach: () => { each = true; return api; },

//     strict(policy: MissingPolicy = "warn") { missingPolicy = policy; return api; },
//     defer() { autoEnabled = false; return api; },

//     preventDefault(): ListenerBuilder { _prevent = true; return api; },
//     stopProp(): ListenerBuilder { _stop = true; return api; },
//     stopImmediateProp(): ListenerBuilder { _stopImmediate = true; return api; },
//     stopAll(): ListenerBuilder { _stopImmediate = _stop = _prevent = true; return api; },
//     clearStops(): ListenerBuilder { _stopImmediate = _stop = _prevent = false; return api; }
//   };

//   return api;
// }
