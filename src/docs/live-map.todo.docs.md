liveTree = “operate on HTML via a stable JSON model (NEW)”.
liveMap = “render JSON into a human-readable, editable HTML view, and optionally keep it live and bidirectional.”
Here’s the shape of the problem and where the difficulty sits, relative to liveTree.
Concept split
Snapshot (read-only): one-way render of a JSON value to HTML. No interactivity; rerender on demand.
Dashboard (live readout): one-way render that auto-updates when JSON changes (subscribe to model events and patch the DOM).
Control Panel (editable): two-way binding: DOM edits flow back to JSON; JSON updates flow to DOM.
Core pieces you’ll need
View schema (even if implicit):
Mapping from JSON → widgets and labels. Without hints, you’ll guess:
object → key/value rows;
array → list/table;
primitives → text/span (display) or input[type=…] (edit).
A light schema lets you pick correct controls (number vs slider vs checkbox), ranges/steps, labels, order, hidden fields, grouping, etc. You can default heuristically and allow overrides per key path.
Renderer:
Deterministic HTML from a JSON subtree + schema node. Reuse your NEW node machinery: generate NEW for the view (e.g., <div class=row><span class=label>key</span><span class=value>…</span></div>), then pipe through your existing NEW→DOM path. Keys become text labels or data-label—not tags.
Identity + patching:
Reuse QUIDs to give each rendered field a stable identity. When data changes, compute a minimal patch: update text, input value, rows added/removed/reordered. Do not fully rerender on each tick.
Binding layer (two-way only):
Outbound: subscribe to model mutations; apply DOM patches.
Inbound: delegate input/change events; map [data-_quid] (or path) → model path; validate; write back. Guard with the same reentrancy counter you planned for DOM sync.
Validation + coercion:
Numbers, booleans, enums, dates. Schema drives this; fallback heuristics otherwise. Show invalid state but don’t corrupt the model.
Layout + paging for scale:
Large arrays/objects need collapse/expand, lazy render, and virtual lists to avoid DOM blow-ups.
A11y + keyboard:
Labels (<label for=…> or ARIA), focus rings, tab order. Easy to skip; painful later.
Difficulty vs liveTree
Snapshot: easier than liveTree. It’s just a serializer with a presentational template.
Dashboard (one-way live): roughly comparable to the non-sync parts of liveTree. You already have identity and maps; the main work is patching and avoiding full rerenders.
Control Panel (two-way): this is where difficulty climbs. It overlaps with the DOM→model sync you just scoped: event capture, validation, reentrancy, array reindexing, conflict policy. Still simpler than “arbitrary external edits” because you own the widgets and their semantics.
Clean architecture (keeps it tractable)
Model events: fire onChange(path, op, payload) from your NEW mutators.
Schema mini-DSL: { type, widget, min, max, step, enum, label, description, readonly, hidden } at paths. Optional, merge with heuristics.
Path addressing: stable JSONPointer/dot-path per field; store it in _meta of the view NEW node and mirror to DOM via data-path (or just rely on QUID).
Renderer contract: render(path, value, schemaNode) -> NEW subtree.
Patcher: diff old vs new at the view NEW level (cheap; structure known) and apply minimal DOM ops via existing maps.
Binding: event → path → coerce/validate → set in model → renderer patch executes.
Controls registry: map {type, hints} → input component. Defaults:
boolean → checkbox
number → number/slider (use min/max/step if present)
string (short) → text; (long) → textarea; (matches URL/email) → specialized
enum → select/radios
array<object> small → table; else list with row components
object → section with labeled rows
Where the gotchas live
Arrays: insert/delete/reorder must maintain _ii/data-_index invariants. You’ve already hardened this—reuse the same helpers.
Coercion drift: DOM gives you strings; model wants numbers/booleans/dates. Keep coerce() symmetric with your serializers.
Performance: naïve rerender on every keystroke will jank; patch the single field or debounce.
Schema absence: heuristics can pick wrong widgets; permit runtime overrides per path.
Staleness: if someone mutates the JSON through other APIs, dashboard must update; you need a single source of truth and change notifications.
Suggested milestones
Snapshot view for primitives/objects/arrays; labels visible.
Dashboard: subscribe to model events; patch text/attrs; expand/collapse; basic paging.
Control inputs for primitives with validation; two-way for booleans/numbers/strings/enums.
Arrays of objects editing (add/remove/reorder rows).
Schema overrides (per-path widgets, constraints).
Perf polish (virtual lists, batched patches).
A11y polish.
API sketch (conceptual)
liveMap.render(rootValue, schema?) -> LiveTree_NEW (returns a LiveTree handle to the view)
liveMap.attach(model, rootEl, schema?) (dashboard; subscribes to model)
liveMap.control(model, rootEl, schema?) (control panel; two-way binding)
Bottom line: liveMap is straightforward as a snapshot, manageable as a dashboard, and moderately complex as a full control panel. It should be simpler than liveTree’s DOM sync because you control the generated markup and the widgets. Your existing QUID, maps, coercion, and array/index machinery give you most of the skeleton already.

*** +: setAttrs() (multiple attribute setter - pass an object and all attrs are applied)

TODO - event listeners
