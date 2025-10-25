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

biggest opportunities:
State plane & persistence
Treat every window as a tiny HSON subtree: [_elem: 'hson-window', _attrs: {x,y,w,h,open,title}, children…].
Snapshots serialize 1:1, sort deterministically, round-trip cleanly. That makes saving/restoring sessions trivial (and diffable).
Patches as the transport
Drag/resize/close emit HSON deltas (set _attrs.x, set _attrs.y, etc.).
Your store (or liveMap later) applies those patches; the element reflects via attributes.
This avoids bespoke event payload shapes and keeps everything testable with the same compare utilities you already built.
Normalization boundary
All the hairy escaping/booleans/whitespace rules you fixed become the canonical edge between component and world.
Inside the component: simple strings/lengths/flags. Outside: HSON ensures “required means required="required"”, style objects stable, entities normalized.
Slot composition via HSON
Represent slotted children as _elem with _attrs.slot = 'actions-end' etc.
HSON → DOM gives you declarative slotting; DOM → HSON gives you reliable snapshots of ad-hoc UI composition.
Deterministic layout ops
Multi-window moves/tiling are just batch HSON patches over a selection (same “selectors” you use in tests).
Undo/redo = patch log. Time-travelable demos for free.
Testing & fixtures
Your existing node comparer becomes the golden oracle: mount two windows, mutate via DOM, assert the HSON snapshot equals expected.
Cross-format tests (HTML/JSON/HSON) keep the component honest about attrs/flags/entities.
Schema & migrations
Define a tiny schema for the component’s _attrs (types + defaults).
If you rename w→width, a migration is a pure HSON transform; the window doesn’t need legacy branches.
Remote/control plane
Because patches are data, a remote peer can drive windows (presentations, collab) without shipping imperative code—just HSON ops.
Devtools hooks
Expose a data-hson-id and log each emitted patch. Your existing diffs render instantly digestible inspector views (no bespoke devtool).
Security boundary
Let the component opt into “HSON-safe” attributes/styles only; offload sanitization to the HSON layer you already hardened.

Phase 1 — Bare window component
Tag: <hson-window>
Shadow DOM with:
top bar (title slot + start/end action slots)
scrollable content area (default slot)
Attributes (stringy, reflected to CSS vars): open, x, y, w, h, title
A11y: role="group", aria-labelledby to the title element
Parts: window, titlebar, title, actions-start, actions-end, content
CSS vars for skinning: --window-bg, --titlebar-height, --content-pad, etc.
No motion yet. No resizing. Just renders and toggles via open.
Phase 2 — Minimal interaction (still standalone)
Move: pointerdown on titlebar → translate during drag (CSS transform), commit to x/y attrs on pointerup.
Resize: explicit bottom-right grip; transform during drag, commit to w/h.
Events: dispatch hson:window-move|resize|focus|close with {x,y,w,h} detail (bubbled, composed).
Guard: internal writes flip a boolean so MutationObserver (later) won’t loop.
Phase 3 — Observability hooks (to spot HSON seams)
Logging toggle (data-debug): on any attr change or pointer-end, log a compact record: {kind:'move', x,y}, {kind:'resize', w,h}, {kind:'attr', name,value}.
Dev CSS: ::part(titlebar) highlight when focused/dragging; simple visual sanity.
Phase 4 — Micro tests (DOM-level, no framework)
Mount one window; set x/y/w/h attrs programmatically → assert inline style vars applied.
Simulate drag (dispatch pointer events) → assert attributes commit at end and a custom event fired.
Slot churn: replace content; assert no layout crash and scroll stays intact.
Where HSON naturally snaps in later
Replace event payloads with HSON patches (same data, different envelope).
Add a tiny MutationObserver on the host (attributes only) to emit patches; ignore internal writes via the guard.
Allow an optional <script type="application/hson">… child as a data source; parse once on connect.
Guardrails
Always transform during drag; commit attrs at rest.
Respect prefers-reduced-motion for hover/“reach” effects later.
Keep the attr schema stable; introduce new behavior via attributes/events, not ad-hoc methods.