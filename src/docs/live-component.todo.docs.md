- hson.liveComponent - possible directions
MutationObservers
Watch attributes and subtree changes and translate them into domain events or HSON ops.
Great for: reflecting x/y/w/h/open/title changes, slot content swaps, or “this component just received new children”.
Avoid observing the universe. Scope to your host + slotchange and turn it off during internal updates.
Three integration modes (from boring → spicy)
Dumb component (MVP)
Treat <hson-window> like any <div>.
State lives in attributes (open, x, y, w, h, title).
Component reflects attributes ↔ internal state; emits custom events (window-move, window-resize, window-close).
HSON just serializes/patches attributes; no special paths.
Bound component (light coupling)
The component accepts a payload via one of:
a data-hson attribute (stringified HSON/JSON), or
a <script type="application/hson">…</script> child (slot-private).
On connectedCallback, it parses once, renders, and subscribes to later changes (attribute updates, slotchange, a “reload” event).
Emits domain events with deltas (detail: {patch:[…]}), which your liveTree can consume.
Live component (two-way bridge)
A root like <hson-live-tree> owns a LiveMap/store.
On connect: ingest HSON, render subtree.
Observe its subtree (filtered): attribute/structure deltas → synthesize HSON ops.
Also listen to store ops → apply DOM patches.
Needs loop-guards (a monotonic “origin” token) to avoid re-entrancy.
Contracts that make HSON happy
Attribute reflection is the API. If the user drags/resizes, set attributes (x/y/w/h/open) and emit events. HSON can watch attributes and remain stateless.
Custom events are the transport. Namespaced, boring, bubbled, composed:
new CustomEvent('hson:window-move', { bubbles:true, composed:true, detail:{ x, y } })
Stable parts and slots. Parts: window, titlebar, title, actions-start, actions-end, content, grip. Slots: "title", "actions-start", "actions-end", default.
CSS variables for theming. --window-bg, --titlebar-height, --hover-scale, etc. No inline style churn.
MutationObserver setup (practical)
Observe the host with { attributes:true, attributeFilter:['open','x','y','w','h','title'] }.
Listen to slotchange on the default/content slot for content swaps.
During internal writes, set a guard (this._mutating = true) and ignore MO callbacks in that phase.
Loop-safety (the footgun to avoid)
Any time you mirror a DOM change → HSON op → DOM change, tag the write with an origin id (data-origin="hson"), or keep a micro-queue of attribute writes you originated; the observer ignores those entries. Simple and effective.
The window MVP you can build now (no framework)
Attrs: open, x, y, w, h, title, movable, resizable.
Events: hson:window-move, hson:window-resize, hson:window-close, hson:window-focus.
Behavior:
Move on titlebar drag (transform during drag, commit to attrs on pointerup).
Resize on an explicit corner grip (bigger hit area than visuals).
“Reach toward cursor”: tiny transform/scale on nearest interactive part; respect prefers-reduced-motion.
Ambiguous-hit feedback: if pointerup lands near but not within, flash a subtle border; do not activate.
How HSON lines up usefully
Serialization: your existing tag/attr machinery already handles <hson-window> like any HTML node—no special casing.
Determinism: attributes are sorted/normalized by you; events carry precise deltas; round-trips stay stable.
Progressive enhancement: if JS dies, it’s still a <section> with a header and content—HSON can still read/write it.
Small roadmap (stay agile)
Ship MVP <hson-window> with attribute reflection + events.
Add MutationObserver for attrs + slotchange, with loop-guard.
Write two tiny tests:
set x/y attribute → window moves; emits no extra change event.
drag window → attributes update and an event fires; observer doesn’t loop.
Optional: a <hson-button> with the same reflection/event pattern (you’ll need it for the titlebar actions).
Later: prototype <hson-live-tree> that ingests a mini HSON blob on connect and re-renders a child subtree, using the same contracts.