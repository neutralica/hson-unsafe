// listen.types.ts

/**************************************************************
 * Typed alias for DOM event mapping on `HTMLElement`.
 *
 * This mirrors `HTMLElementEventMap` from the DOM lib so the
 * listener API can:
 *   - offer strongly-typed `ev` objects per event type
 *   - constrain `on<K>()` calls to real event names only
 *
 * All higher-level listener helpers (onClick, onKeyDown, etc.)
 * are defined in terms of this underlying map.
 **************************************************************/
export type ElemMap = HTMLElementEventMap;

// TODO - doc
export type CustomEventHandler<D = unknown> = (ev: CustomEvent<D>) => void;

/**************************************************************
 * Per-listener configuration options.
 *
 * These flags mirror native `addEventListener` options, plus
 * a `target` selector that steers *where* the listener attaches:
 *
 *   - `capture`  → use capture phase instead of bubble
 *   - `once`     → auto-remove after the first event fires
 *   - `passive`  → hint that the handler never calls preventDefault
 *   - `target`   → which EventTarget to bind:
 *                    • "element"  (default) → the bound DOM element
 *                    • "window"            → global window
 *                    • "document"          → global document
 *
 * The builder snapshots these options when the listener is
 * attached, so later mutations do not retroactively affect
 * already-registered handlers.
 **************************************************************/
export type ListenOpts = {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  target?: "element" | "window" | "document";
};

/**************************************************************
 * Policy for how to react when the intended EventTarget cannot
 * be resolved at attach time.
 *
 *   - "ignore" → silently skip attachment; `ListenerSub.ok`
 *                will be false and `count` will remain 0.
 *   - "warn"   → log a console warning but continue running.
 *   - "throw"  → throw immediately, treating missing targets
 *                as a hard configuration error.
 *
 * Used by `.strict(...)` on the ListenerBuilder to control
 * how brittle or forgiving listener setup should be.
 **************************************************************/
export type MissingPolicy = "ignore" | "warn" | "throw";

/**************************************************************
 * Handle returned by `.attach()` (or auto-attach).
 *
 * Represents the concrete attachment(s) made from a builder:
 *
 *   - `off()`   → idempotently remove all underlying listeners
 *                 from their EventTargets.
 *   - `count`  → number of actual `addEventListener` calls that
 *                 succeeded (e.g., 0 if target was missing).
 *   - `ok`     → shorthand for `count > 0`, useful in tests and
 *                 for defensive runtime checks.
 *
 * This is the low-level, side-effectful counterpart to the
 * fluent ListenerBuilder configuration surface.
 **************************************************************/
export interface ListenerSub {
  off(): void;
  /** number of concrete EventTarget attachments performed */
  count: number;
  /** true iff count > 0 */
  ok: boolean;
}

// /**************************************************************
//  * Fluent builder for DOM event listeners.
//  *
//  * A ListenerBuilder captures three things:
//  *   1) *What* to listen for (event type + handler),
//  *   2) *Where* to attach (element / window / document),
//  *   3) *How* to behave (capture / once / passive / strictness).
//  *
//  * The sequence is:
//  *   - configure:
//  *       .on("click", handler)
//  *       .once().passive().toWindow().strict("throw")
//  *   - then attach:
//  *       const sub = builder.attach();
//  *
//  * Key groups:
//  *   • Typed events:
//  *       - `on<K>()` for generic HTMLElement events
//  *       - shorthands like `onClick`, `onKeyDown`, etc.
//  *
//  *   • Options:
//  *       - `once()` / `passive()` / `capture()`
//  *       - `toWindow()` / `toDocument()` (vs default "element")
//  *
//  *   • Validation / scheduling:
//  *       - `strict(policy)` controls behavior when no target
//  *         exists at attach time ("ignore" | "warn" | "throw").
//  *       - `defer()` disables auto-attach; caller *must* invoke
//  *         `.attach()` manually to materialize listeners.
//  *
//  *   • Event flow controls:
//  *       - `preventDefault()`
//  *       - `stopProp()` (stopPropagation)
//  *       - `stopImmediateProp()`
//  *       - `stopAll()` (apply all of the above)
//  *       - `clearStops()` (reset to pass-through)
//  *
//  * Implementations are expected to:
//  *   - be immutable or copy-on-write per call, so chained calls
//  *     do not unexpectedly mutate previously attached configs,
//  *   - enforce type safety for event payloads via `EMap`,
//  *   - return the same builder type from each fluent method so
//  *     long chains remain correctly typed.
//  **************************************************************/
// export interface ListenerBuilder {
//   /*----- typed events */
//   on<K extends keyof ElemMap>(type: K, handler: (ev: ElemMap[K]) => void): ListenerBuilder;
//   onClick(h: (ev: MouseEvent) => void): ListenerBuilder;
//   onMouseMove(h: (ev: MouseEvent) => void): ListenerBuilder;
//   onMouseDown(h: (ev: MouseEvent) => void): ListenerBuilder;
//   onMouseUp(h: (ev: MouseEvent) => void): ListenerBuilder;
//   onKeyDown(h: (ev: KeyboardEvent) => void): ListenerBuilder;
//   onKeyUp(h: (ev: KeyboardEvent) => void): ListenerBuilder;

//   /*----- options */
//   once(): ListenerBuilder;
//   passive(): ListenerBuilder;
//   capture(): ListenerBuilder;
//   toWindow(): ListenerBuilder;
//   toDocument(): ListenerBuilder;

//   /*----- validation / scheduling */
//   strict(policy?: MissingPolicy): ListenerBuilder; // default "warn"
//   defer(): ListenerBuilder; // cancel auto-attach for manual attach()

//   // may remove some day, seeing if this ubreaks something
//  attach(): ListenerSub;
//   /* Auto-attach will also return a handle. */
//   preventDefault(): ListenerBuilder;
//   stopProp(): ListenerBuilder;
//   stopImmediateProp(): ListenerBuilder;
//   stopAll(): ListenerBuilder;
//   clearStops(): ListenerBuilder;
// }

export interface ListenerBuilder {
  on<K extends keyof ElemMap>(type: K, handler: (ev: ElemMap[K]) => void): ListenerSub;

  // NEW: common convenience events
  onInput: (fn: (ev: InputEvent) => void) => ListenerSub;
  onChange: (fn: (ev: Event) => void) => ListenerSub;        // change is just Event in TS DOM libs
  onSubmit: (fn: (ev: SubmitEvent) => void) => ListenerSub;

  onClick(h: (ev: MouseEvent) => void): ListenerSub;
  onMouseMove(h: (ev: MouseEvent) => void): ListenerSub;
  onMouseDown(h: (ev: MouseEvent) => void): ListenerSub;
  onMouseUp(h: (ev: MouseEvent) => void): ListenerSub;
  onKeyDown(h: (ev: KeyboardEvent) => void): ListenerSub;
  onKeyUp(h: (ev: KeyboardEvent) => void): ListenerSub;
  
  // NEW: strongly-typed CustomEvent detail (still uses string event name)
  onPointerDown: (fn: (ev: PointerEvent) => void) => ListenerSub;
  onPointerMove: (fn: (ev: PointerEvent) => void) => ListenerSub;
  onPointerUp: (fn: (ev: PointerEvent) => void) => ListenerSub;
  onFocusIn: (fn: (ev: FocusEvent) => void) => ListenerSub;
  onFocusOut: (fn: (ev: FocusEvent) => void) => ListenerSub;
  
  // NEW: custom events / “anything else”
  onCustom: <E extends Event = Event>(type: string, handler: (ev: E) => void) => ListenerSub;
  onCustomDetail: <D>(type: string, handler: (ev: CustomEvent<D>) => void) => ListenerSub;

  // option modifiers: these return a *configured* api for the next registration
  once(): ListenerBuilder;
  passive(): ListenerBuilder;
  capture(): ListenerBuilder;
  toWindow(): ListenerBuilder;
  toDocument(): ListenerBuilder;

  strict(policy?: MissingPolicy): ListenerBuilder;

  preventDefault(): ListenerBuilder;
  stopProp(): ListenerBuilder;
  stopImmediateProp(): ListenerBuilder;
  stopAll(): ListenerBuilder;
  clearStops(): ListenerBuilder;
}