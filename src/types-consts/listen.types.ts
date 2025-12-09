export type EMap = HTMLElementEventMap;

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
  /*----- typed events */
  on<K extends keyof EMap>(type: K, handler: (ev: EMap[K]) => void): ListenerBuilder;
  onClick(h: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseMove(h: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseDown(h: (ev: MouseEvent) => void): ListenerBuilder;
  onMouseUp(h: (ev: MouseEvent) => void): ListenerBuilder;
  onKeyDown(h: (ev: KeyboardEvent) => void): ListenerBuilder;
  onKeyUp(h: (ev: KeyboardEvent) => void): ListenerBuilder;

  /*----- options */
  once(): ListenerBuilder;
  passive(): ListenerBuilder;
  capture(): ListenerBuilder;
  toWindow(): ListenerBuilder;
  toDocument(): ListenerBuilder;
  onEach(): ListenerBuilder;

  /*----- validation / scheduling */
  strict(policy?: MissingPolicy): ListenerBuilder; // default "warn"
  defer(): ListenerBuilder; // cancel auto-attach for manual attach()


  /* Auto-attach will also return a handle. */
  preventDefault(): ListenerBuilder;
  stopProp(): ListenerBuilder;
  stopImmediateProp(): ListenerBuilder;
  stopAll(): ListenerBuilder;
  clearStops(): ListenerBuilder;
}
