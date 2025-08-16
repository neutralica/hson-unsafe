hson-unsafe — status update & handoff 
branch & layout
Working branch: hson-refactor (stable tag exists on main).
Split codebase:
src/core/… → stable, format-agnostic types/utilities.
src/old/… → frozen, pre-refactor implementations.
src/new/… → refactor targets (NEW types/logic).
Original entry paths now thin wrappers that call old (and optionally shadow-run new).
types (authoritative)
Core (shared): Primitive, BasicValue, JsonAny, JsonObj (no _meta in core JSON types).
OLD node: HsonNode with _content: (HsonNode|Primitive)[], _meta = { attrs, flags }.
NEW node: HsonNode_NEW with:
_attrs: HsonAttrs_NEW (all HTML-ish attributes, including style as string|object).
_meta: HsonMeta_NEW (non-HTML “system” fields only; currently: 'data-index', 'data-quid').
VSN tags: _root, _obj, _array, _elem, _ii, _str, _val
(note: VAL_TAG is _val, not __val).
meta/attrs decisions
In-memory:
NEW keeps user-facing attributes in _attrs.
NEW keeps system metadata in _meta (whitelist keys; today: 'data-index', 'data-quid').
On-wire (HTML/HSON) serialization:
_meta is encoded as data-_… attributes:
_meta['data-index'] ⇄ data-_index="…" (only meaningful on <_ii>).
_meta['data-quid'] ⇄ data-_quid="…" (optional; generally runtime-only).
Do not emit literal <_elem> in HTML; unwrap its children in output.
JSON serialization:
May include _meta directly in JSON objects (no on-wire encoding needed).
invariants (enforced/checked)
<_array> children are all <_ii>.
Each <_ii> has exactly one child.
VSNs do not carry _attrs (only standard tags do). <_ii> may carry _meta (index).
Parsing HTML that contains literal <_elem> is an error.
style attribute parsed to an object; serializer emits stable, key-sorted CSS.
compat layer
toNEW(HsonNode) -> HsonNode_NEW and toOLD(HsonNode_NEW) -> HsonNode:
Folds legacy flags → _attrs as key="key".
Preserves _meta keys (stringifies 'data-index').
Equality:
Canonical deep key-sorter used for comparing serialized outputs.
Node comparison ignores runtime-only fields (e.g., 'data-quid') when assessing parity.
shadow mode (simple)
Single runtime toggle: window.__HSON_SHADOW__ = true/false.
Wrappers always return OLD, but when shadow is on:
Run NEW in parallel, convert to OLD via toOLD, compare, and log diffs.
No auto flip. When parity is clean, we will change the wrapper import to new and remove shadow.
status by pipeline
JSON
NEW parse/serialize implemented and parity-checked via wrappers.
Wrapper compares canonicalized results; still returns OLD.
Stable factories NEW_NODE / NEW_NEW_NODE used; no STR/VAL wrappers in JSON output.
HTML
NEW parser/serializer in progress under src/new/….
Parser: maps data-_index ⇄ _meta['data-index']; errors on literal <_elem>; enforces VSN shape.
Serializer: emits data-_index only on <_ii>; unwraps _elem; stable style string.
Entry wrappers exist; currently return OLD, shadow-compare NEW when enabled.
HSON
Tokenizer is large; refactor pending (not blocked by JSON/HTML progress).
Current tokenizer runs; edge-case tightening planned after HTML lands.
tooling
Pre-commit & pre-push hooks run npm run check (TypeScript --noEmit).
Project compiles green on hson-refactor.
Wrappers live at original call sites; old/new implementations live under src/old / src/new.
open items to finish HTML cutover
Complete NEW HTML serializer normalization (CSS/string escaping).
Ensure comparator ignores 'data-quid' by default.
Add guard: VSNs must not carry _attrs (dev warning/throw).
Keep _val vs _str coercion strict.
Once shadow logs are clean, flip imports to NEW and delete shadow code for HTML; then repeat for HSON.
/* permanent comment style: use /* … */ for durable notes; // for temporary todos */