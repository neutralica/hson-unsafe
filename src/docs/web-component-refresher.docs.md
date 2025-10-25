Web Components Refresher

Custom element class: class MyThing extends HTMLElement { … } then customElements.define('my-thing', MyThing).
Lifecycle:
connectedCallback() — element hit the DOM. Wire listeners, create Shadow DOM if you want, kick off rendering.
disconnectedCallback() — clean up listeners/observers.
attributeChangedCallback(name, oldV, newV) — reflect attributes → internal state or vice-versa.
adoptedCallback() — (rare) moved across documents.
Attribute/prop reflection:
Static observedAttributes = ['open', 'title', …].
Keep props and attrs in sync (stringy attrs; typed props).
Shadow DOM:
this.attachShadow({ mode: 'open' }).
Style isolation + slots for user content.
Styling hooks: :host, :host([state]), ::part(name), exportparts.
Theming: CSS custom props on :host.
Slots:
Default slot for body.
Named slots (<slot name="title">, <slot name="toolbar">, etc.) for top bar/buttons.
Events:
Fire DOM events (this.dispatchEvent(new CustomEvent('close', {…}))) so consumers don’t need library glue.
The window you want: anatomy
Tag: <hson-window>…</hson-window>
Layout (Shadow):
:host as positioned container (stacking context).
Top bar: title area + left/right action zones.
Content: scrollable region (slot).
Grip(s): a corner handle and optional side handles (explicit, not edge-hover).
Slots:
slot="title" — optional; otherwise use title attr.
slot="actions-start" — left top-bar actions (e.g., “back” / “menu”).
slot="actions-end" — right top-bar actions (close, maximize).
default slot — main content.
Parts (so outside CSS can skin it even with shadow):
part="window" | "titlebar" | "title" | "actions-start" | "actions-end" | "content" | "grip".
Attributes / Properties:
title (string) — reflected.
open (boolean) — show/hide (don’t destroy state when hidden).
x, y (numbers / CSS lengths) — position.
w, h (numbers / CSS lengths) — size.
resizable (boolean) — expose grips.
movable (boolean) — draggable titlebar.
modal (boolean) — optional “overlay” mode (trap focus, aria-modal).
CSS Custom Props (skin without busting shadow):
--window-bg, --window-radius, --window-shadow
--titlebar-height, --titlebar-bg, --titlebar-fg
--content-padding
--hover-scale (for your “reach toward cursor” effect)
Events:
window-move { x, y } (during drag) and window-moveend.
window-resize { w, h } and window-resizeend.
window-close (user intent).
window-focus / window-blur (for z-index stacking).
A11y:
Role: the host should be role="dialog" (modal) or role="group" (non-modal).
Title association: aria-labelledby → the rendered title node id.
Focus within: keep focus in content by default; titlebar buttons are tabbable.
Escape closes when modal.
Interactions (mouse + touch + “eager UI”)
Move:
Pointer events on the titlebar (not the whole bar—leave space for selecting text if needed).
Translate via CSS transform during drag for perf; commit to x/y at pointerup.
Snap to viewport edges (optional).
Resize:
Explicit corner grip (bottom-right is enough) with a visible handle.
Optional side grips if you want.
Increase target size beyond visuals (“hit slop”) using ::before with transparent area.
“Reach toward cursor” (subtle, practical):
On pointermove over the host, compute proximity to the nearest interactive part (titlebar, grip, close button).
Apply very small transform/scale (≤ 1.06) and/or shadow lift to that part.
Don’t shift layout; use transform only. Smooth with transition and clamp changes.
Respect prefers-reduced-motion.
Ambiguous hit feedback:
If the up event lands outside the primary target but inside the host, briefly flash a thin border on the intended target and ignore the click (no side-effect)—a polite “I heard you, adjust and try again.”
Track miss distance; if it’s consistently biased, you can offset the next hover affordance slightly toward the cursor side (but keep it subtle).
State model (plays well with live-tree)
Keep a single internal state object: { open, x, y, w, h, active }.
Reflect the public ones to attributes so your HSON <-> node converters have a single source of truth.
MutationObserver:
Observe host attributes; when HSON updates x, y, etc., apply transforms immediately (no reflow).
If you want content-driven sizing, observe slot changes and recompute min/max constraints.
Integration points with HSON/live-tree
Your serializer can treat <hson-window> like any other tag: _attrs includes x/y/w/h/open/title.
Live updates:
When the user drags/resizes, dispatch events and also set attributes (so HSON sees the change without special cases).
Avoid storing ephemeral “dragging” state in attributes; keep that internal.
Buttons (for when you wire them)
Make a generic <hson-button> with:
Attrs: kind="primary|ghost|danger", size="s|m|l", pressed (ARIA aria-pressed when toggle), disabled.
Parts: button, label, icon.
Hit slop and “reach” behavior same as the window grips.
Emit button-activate instead of relying on click semantics (still fire a click for native compatibility).
Implementation rail-guards
Don’t do layout with JS; position via CSS variables and transforms; write back at rest.
All micro-animations must be interruptible and clamped.
Z-index stacking: when a window receives pointerdown, raise it by toggling a data-active or bumping a CSS var in a central manager (no global singleton—use an event on document or a lightweight registry module).
Keep every preflight/parser habit out of here—components should be dumb about parsing and smart about interaction.