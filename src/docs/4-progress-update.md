# progress update 4 : hson-unsafe — refactor 

branch & layout
Working branch: hson-refactor (stable tag exists on main).

Split codebase:
src/core/… → stable, format-agnostic types/utilities.
src/old/… → frozen, pre-refactor implementations.
src/new/… → refactor targets (NEW types/logic).
Original entry paths now thin wrappers that call old (and optionally shadow-run new).

# types (authoritative)
Core (shared): Primitive, BasicValue, JsonAny, JsonObj

OLD node: HsonNode with _content: (HsonNode|Primitive)[], _meta = { attrs, flags }.
NEW node: HsonNode with:
_tag (unchanged)
_content (unchanged)
_attrs: HsonAttrs (all HTML-ish attributes, including style as string|object).
_meta: HsonMeta (non-HTML “system” fields only; currently: 'data-index', 'data-quid').
VSN tags: _root, _obj, _arr, _elem, _ii, _str, _val

# _meta/_attrs decisions
In-memory:
NEW keeps user-facing attributes in _attrs.
NEW keeps system metadata in _meta (currently using: 'data-_index', 'data-_quid'); _META_DATA_PREFIX 'data-_' is reserved for _meta properties; any attribute beginning with 'data-_' gets moved to _meta; standard data-* attributes (no underscore) stay in attrs as user data

# On-wire (HTML/HSON) serialization:
_meta is encoded as data-_… attributes:
_meta['data-_index'] (keeps sequence of <_ii> _arr children).
_meta['data-_quid'] (optional; generally runtime-only--for creating persisting references to nodes as they are moved around the tree).
Do not emit literal <_elem> in HTML; unwrap its children in output.

# JSON serialization:
if the source of the data is html, JSON may include _meta directly in JSON objects (it will always be '_meta.data-_*').
invariants (enforced/checked)
<_arr> children must all be <_ii>, with a data-_index.
Each <_ii> has exactly one child.
VSNs do not carry _attrs (only standard tags do). VSNs **may** carry _meta

Any HTML that contains literal <_elem> is an error - the _elem is supposed to be unwrapped when serializing to html

style attribute parsed to an object; serializer emits stable, key-sorted CSS (via parse_style(), serialize_style() helpers)


compat layer
toNEW(HsonNode) -> HsonNode 
toOLD(HsonNode) -> HsonNode:
Folds legacy flags (HsonFlags) into newly all-encompassing _attrs (HsonAttrs) as key="key" -> key="key" denotes a flag.
Preserves _meta keys (stringifies 'data-_index').

Equality:
Canonical deep key-sorter used for comparing serialized outputs.

# shadow mode (simple)
Single runtime toggle: SHADOW_ENABLED() (returns true or false).
Wrappers always use the OLD paths, but when (SHADOW_ENABLED()), runs NEW paths in parallel, convert to OLD via toOLD, compare, and log diffs.
 When parity is clean, we will change the wrapper import to new and remove old paths and shadow etc.

# status by pipeline
- JSON
NEW parse/serialize implemented and parity-checked via wrappers.
Wrapper compares canonicalized results; still returns OLD.
Stable factories NEW_NODE; no STR/VAL wrappers in JSON output.
***JSON REFACTOR IS BELIEVED STABLE***

- HTML
NEW parser/serializer under src/new/….
Parser: maps data-_index to _meta['data-_index']; errors on literal <_elem> tags found in html; enforces VSN shape.
Serializer: emits data-_index on <_ii>; unwraps _elem before serializing into html; stable style string.

Entry wrappers exist; currently return OLD, shadow-compare NEW when enabled.
***HTML REFACTOR IS BELIEVED STABLE***

- HSON (***IN PROGRESS***)
Tokenizer refactor mostly complete? 1000 LOC -> ~360
Current tokenizer runs; small diffs here and there; it's not clear 

tooling
Pre-commit & pre-push hooks run npm run check (TypeScript --noEmit).
Project compiles green on hson-refactor.
Wrappers live at original call sites; old/new implementations live under src/old / src/new.


Once shadow logs are clean, flip imports to NEW and delete shadow code for all old paths

{{user}}'s preferred comment style: 
use /* … */ for durable notes that persist as docs; 
use // for temporary notes, comments and todos 