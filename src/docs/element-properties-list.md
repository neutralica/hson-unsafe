ELEMENT PROPERTIES - WHICH TO EXPOSE

The goal is: only expose properties that (a) users actually edit at runtime, or (b) are necessary commands/sensors the platform owns. Everything else stays in attributes.
Naming (keep it small and honest)
handle.props() → safe, model-relevant read/write properties (tiny whitelist).
handle.cmd() → imperative methods (do things, don’t store things).
handle.measure() → read-only sensors (layout/scroll/compute snapshots).
Avoid a generic .prop(name); it invites two sources of truth.
Props (read/write unless noted)
Form controls (the important ones)
value (input/textarea) — live value. Mirror to value attribute only when you need persistence/serialization.
checked (checkbox/radio) — live state. Optionally sync defaultChecked/checked attribute for persistence.
indeterminate (checkbox) — visual tri-state; not serialized. Don’t mirror.
valueAsNumber (number/date/time-capable inputs) — numeric view over value. Coerce before writing to model.
valueAsDate (date/time-capable inputs) — Date|null. Treat carefully; serialize canonically.
selectionStart, selectionEnd, selectionDirection (text inputs/textarea) — caret control.
selectedIndex (select) — index API.
multiple (select) — boolean prop reflects attribute; usually set via attribute.
files (file input) — read-only for security; never “set”.
open (<details>) — reflects attribute; use when you need programmatic toggle (also mirror open attribute if you persist).
Focus/navigation
tabIndex — number; reflects attribute. Rarely changed at runtime, but useful for focus traps.
inert — boolean; reflects attribute. Good for modal stacks.
Dialog
open (<dialog>) — reflects attribute; see commands below.
Media elements (if you render audio/video)
currentTime
playbackRate
volume (0–1)
muted
loop
(read-only: paused, duration, ended, readyState belong under measure())
Content editing (when you support editors)
contentEditable (string: "true"|"false"|"inherit") — mirrors attribute; prefer setting attribute.
isContentEditable — read-only; belongs under measure().
Commands (imperative; do not try to “mirror” these)
Focus: focus(), blur()
Selection: setSelectionRange(start, end, direction?)
Scrolling: scrollTo(x, y | options), scrollBy(...), scrollIntoView(options)
Dialog: show(), showModal(), close(returnValue?)
Media: play(), pause()
Measure (read-only snapshots; never persisted)
Box/layout: getBoundingClientRect(), clientWidth, clientHeight, offsetTop, offsetLeft
Scroll metrics: scrollTop, scrollLeft, scrollWidth, scrollHeight (you may expose scrollTop/Left as writable if you want a convenience setter, but treat them as commands semantically)
State probes: isContentEditable, paused (media), duration, readyState
What stays as attributes (not props)
Visual modes and semantics: class, style (you already have setStyle), aria-*, disabled, required, readonly, open (mirrored), multiple (mirrored), autofocus, placeholder, type, name
Data you intend to serialize/inspect: data-* (including your _meta["data-_quid"] mirrored to data-_quid)