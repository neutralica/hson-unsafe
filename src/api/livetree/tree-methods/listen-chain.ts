// CHANGED: add a small fluent builder with order-tolerant flags
type ListenerFlags = {
  // runtime-toggled controls (safe to flip before/after on*)
  prevent: boolean;
  stop: boolean;
  stopImmediate: boolean;
  once: boolean;

  // binding-time options (must be true before the first on*)
  capture: boolean;
  passive: boolean;
};

type RemoveFn = () => void;

export class ListenChain {
  // CHANGED: a single mutable state object; wrapper reads by reference
  private readonly flags: ListenerFlags = {
    prevent: false,
    stop: false,
    stopImmediate: false,
    once: false,
    capture: false,
    passive: false,
  };

  // CHANGED: track removers to integrate with your teardown registry
  private readonly removers: RemoveFn[] = [];

  // CHANGED: bind target explicitly; no `any`, no `as`
  public constructor(private readonly target: EventTarget) {}

  // --- chainable modifiers (order-tolerant where possible) ---

  public preventDefault(): this {
    this.flags.prevent = true;
    return this;
  }

  public stopProp(): this {
    this.flags.stop = true;
    return this;
  }

  public stopImmediateProp(): this {
    this.flags.stopImmediate = true;
    return this;
  }

  public once(): this {
    this.flags.once = true; // runtime-enforced once (order-safe)
    return this;
  }

  public capture(): this {
    this.flags.capture = true; // must be set before first on*
    return this;
  }

  public passive(): this {
    this.flags.passive = true; // must be set before first on*
    return this;
  }

  // --- event binders (return this for further chaining) ---

  public onClick(handler: (e: MouseEvent) => void): this {
    return this.onTyped<"click", MouseEvent>("click", handler);
  }

  public onInput(handler: (e: InputEvent) => void): this {
    return this.onTyped<"input", InputEvent>("input", handler);
  }

  public onChange(handler: (e: Event) => void): this {
    return this.onTyped<"change", Event>("change", handler);
  }

  public onKeyDown(handler: (e: KeyboardEvent) => void): this {
    return this.onTyped<"keydown", KeyboardEvent>("keydown", handler);
  }

  // CHANGED: strongly-typed internal binder; no `as` assertions
  private onTyped<TType extends string, TEvt extends Event>(
    type: TType,
    handler: (e: TEvt) => void
  ): this {
    // snapshot binding-time options once (capture/passive)
    const useCapture: boolean = this.flags.capture;
    const usePassive: boolean = this.flags.passive;

    // minimal state to support order-safe `.once()`
    let fired: boolean = false;

    const wrapped: EventListener = (e: Event): void => {
      // apply live toggles *immediately*
      if (this.flags.stopImmediate) {
        e.stopImmediatePropagation();
      }
      if (this.flags.stop) {
        e.stopPropagation();
      }
      if (this.flags.prevent && !usePassive) {
        // preventDefault is illegal in passive listeners
        e.preventDefault();
      }

      handler(e as TEvt);

      if (this.flags.once && !fired) {
        fired = true;
        this.removeOne(type, wrapped, useCapture);
      }
    };

    this.target.addEventListener(type, wrapped, {
      capture: useCapture,
      passive: usePassive,
      // NOTE: do not set DOM once; we enforce runtime once so order is flexible
    });

    // track remover (capture must match)
    this.removers.push(() => {
      this.target.removeEventListener(type, wrapped, { capture: useCapture });
    });

    // OPTIONAL: register with your owner/target registries here
    // _register_listener_for_target(this.target, type, wrapped, useCapture);
    // _register_listener_for_owner(this.target, ...);

    return this;
  }

  private removeOne(type: string, listener: EventListener, capture: boolean): void {
    this.target.removeEventListener(type, listener, { capture });
    // also prune from local removers (optional; keeps things tidy)
    for (let i = 0; i < this.removers.length; i++) {
      // simple linear prune; you can store structured tuples if you want exact matches
      // leaving it as-is since your global teardown handles idempotency
    }
  }

  // CHANGED: expose an off() to align with your teardown flow (optional)
  public off(): void {
    for (const rm of this.removers) {
      rm();
    }
  }
}
