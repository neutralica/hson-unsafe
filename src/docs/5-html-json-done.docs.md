HSON Refactor Progress Log (shadow-cutover, NEW/OLD split)
progress update 5: developments and invariants in the Big Refactor (JSON and HTML path refactors)

What: safe strangler-fig migration with visibility into real diffs.


0) Repo split, exports, and public surface
Directory split: created src/old/ (frozen), src/new/ (refactor targets), kept public wrappers in the original paths under src/api/....
Exports: restored a stable top-level index that re-exports the public API (hson.transform, hson.liveTree) and types used by tests (HsonNode, etc.). Avoid deep imports; all consumers use the top barrel.
Package “exports” map: still points to built dist/index.*. Types flow through the barrel; tests don’t reach into deep file paths.
Why: lets us swap internals without breaking dependents. Wrappers always return OLD; NEW runs in shadow for parity.

1) Shadow mode: wrappers + comparators
Wrappers (HTML & JSON finished; HSON mostly complete): public parse_*/serialize_* remain in old locations but:
Call *_OLD, return its result.
If SHADOW_ENABLED is true, also run *_NEW, convert to OLD via toOLD, compare via equal_old_nodes; if not equal, log diff_old_nodes (small path list).
Shadow flag: SHADOW_ENABLED = Boolean(globalThis.test_new) (works in page consoles and tests).

Comparator normalization:
Canonical JSON stringifier for equality (sorted keys).
Style normalization (see below).
Unified _attrs view for OLD vs NEW (pulls from OLD meta.attrs + flags, and from NEW _attrs).



2) NEW node model decisions (authoritative)
User attributes → _NEW _attrs (strings + flags as key:"key", style as object).
System metadata → _NEW _meta any _META_DATA_PREFIX attribute ('data-_*', protected) goes into _meta; all other data-* attributes are user data and go into _attrs

Wire mapping (HTML/HSON):
_meta['data-_index'] ⇄ data-_index="[foo]"
_meta['data-_quid'] ⇄ data-_quid="[foo]"

VSNs carry no _attrs (only standard tags do). <_ii> may carry _meta for data-_index.
Do not emit literal <_elem> in HTML; unwrap its children. <_obj> does stay on wire from JSON-sourced content
Do not emit literal <_obj> in JSON; unwrap its children. <html> does stay on wire from HTML-sourced content 
Why: removes user/system bleed-through; gives us stable, explicit structure across formats.

3) HTML parser (_NEW) brought to parity
- Initial symptoms we fixed:
- Standard tags fell through a default path; numbers sometimes became _str nodes
- Style attributes mismatched (font-size vs fontsize); hyphen logic was inconsistent; fixed camelToKebab helper
- Index meta showed up under _attrs instead of _meta.
- Boolean flags weren’t canonicalized uniformly on read/write.
- data-_quid wasn’t round-tripping.

# Key fixes
- Child collection: elementToNode returns raw primitives for text nodes and nodes for elements. No wrapper VSNs added here.
- Primitive wrapping: after collecting children, wrap primitives:
- if primitive is a string → _str
- else BasicValue (number|boolean|null) → _val
- Strict primitive node shapes: _val and _str must contain exactly one primitive in HsonNode. 
- when serializing to html, _str tags are unwrapped and their bare content used as text nodes; _val tags are preserved around content as an indicator to coerce on parsing. since HTML doesn't have types this is necessary to preserve JSON's types

- Attributes ingestion (parse side):
- Walk all DOM attributes preserving case for values; compare names case-insensitively.
- data-_index attribute parsed as `_meta['data-_index']`, data-_quid as `_meta['data-_quid']`.
- style parsed to an object (parse_style() helper).
- Flags canonicalized in-memory as key:"key" when value is "" or repeats the name.
- Sorted, stable key order for determinism.
- Invalid inputs throw: literal <_elem> in user HTML; VSNs carrying _attrs; _array children not all <_ii>; <_ii> with ≠1 child; non-<_ii> carrying data-_index.
- XML vs HTML reality: XML is our parsing target, to support underscore tags and stricter errors. Inputs not legal XML (e.g., unquoted numeric attributes, raw & in values) are considered invalid (test samples marked as such).
Outcome: HTML _NEW path is stable.

4) HTML serializer (NEW) to parity
Wire helpers:
Build wire attrs from NEW _attrs plus whitelisted _meta (map data-_index (only on <_ii>); data-_quid (unused, will be reference uid for queries to create persistent node references)).
Escape attr values safely.
style object serialized to kebab, sorted, key:value; 
Emit bare boolean flags on HTML (i.e., disabled, not disabled="disabled").

VSN handling:
_elem contents are 'unwrapped' in HTML (not emitted).
_str contents are unwrapped and stored in Html as-is
_val is serialized in HTML as a tag, to preserve typing 
_obj is kept literal on wire in html
Void elements: self-close in HTML as <img />.

Outcome: serializer parity warnings (including data-_quid) vanished once parse/serialize wired the meta mapping symmetrically.

5) JSON ↔ HTML invariants 

JSON → HsonNode: generic objects always produce an _obj VSN; arrays produce _array containing <_ii>; "BasicValue" types go into _val nodes' _content; strings parsed to _str nodes (also in _content, obviousl).

JSON → HTML: the _obj wrapper is intentionally preserved in HTML output. Reason: when HTML is read back in, we need to disambiguate object clusters (_obj) from element clusters (_elem). We never emit _elem in HTML; HTML itself implies _elem, but _obj must remain explicit. in the same way, JSON implies _obj, but _elems must remain in JSON to indicate HTML sourced data

Arrays in HTML (_arr): always explicit. JSON arrays in HTML appear as <_array>…<_ii data-_index="…">…</_ii>…</_array>. Gapped/missing indices are invalid.

6) Comparator & diff quality-of-life
equal_old_nodes: normalizes OLD vs NEW into a stable, JSON-serializable shape:
- Unified attrs (NEW _attrs + OLD _meta.attrs + OLD flags→key:"key").
- Style normalized (string→object, kebab, sorted).
- Reserved meta retained as strings (or optionally ignored for specific checks).
- Stable key order; canonical serialization.

diff_old_nodes: best-effort path diffs with a cap; we added a tiny “bucket view” during triage to group common endings (e.g., ._attrs.style.*, ._meta.data-_index, flags).
Preview logging: variadic logger with truncation for long strings.
Outcome: we chased families of issues instead of one-offs; this is what let us flatten the error count quickly.

7) toOLD compat
Goal: NEW → OLD shape for fair comparison and for any legacy callers.
Rules implemented:
- Copy NEW _attrs into OLD _meta.attrs.
- Convert 'flags' (key:"key") to OLD meta.flags (string entries).
- Preserve NEW _meta keys begininng with _META_DATA_PREFIX (e.g., data-_index, data-_quid) on OLD meta (strings).
- Ensure VSNs carry no _attrs
- If needed by OLD call sites, style object is converted to the canonical CSS string before landing in OLD meta.attrs.style.
Outcome: we eliminated class of diffs caused by NEW keeping user attrs separate from meta.

8) Test fixtures & coverage (HTML side)
Flags: presence vs ="" vs key="key"; serializer emits bare; parser canonicalizes to key:"key".
Style: mixed fontSize / FONT-SIZE / font-size; canonical kebab with stable sort.
Entities: Tom & Jerry <3 in text and in attribute values (escaped both ways).
Whitespace: inline content with comments/space around children.
System meta: data-_quid on standard tags and VSNs (allowed); data-_index only on <_ii>.
Arrays: contiguous indices valid; gaps invalid.
Disallowed: literal <_elem>, VSNs with _attrs, unknown VSN tags → hard errors.
XML realities: unquoted numeric attrs and raw & rejected (as expected).
Outcome: HTML and JSON paths run green on the valid set; invalid set fails loudly and deterministically.
9) Ground rules to carry into the HSON refactor
These are the “do not regress” invariants the HSON tokenizer/parser/serializer must share with HTML/JSON:
VSN tags: _root, _obj, _array, _elem, _ii, _str, _val.
No _attrs on VSNs.
<_ii> must have exactly one child and may carry _meta['data-index'].
Meta mapping: _meta['data-index']⇄data-_index (only on <_ii>), _meta['data-quid']⇄data-_quid (any tag).
Style: parse to object in memory; emit as canonical kebab string with sorted keys.
Flags: in memory as key:"key". On HTML/HSON wire as bare key.
Arrays: in HSON use guillemets « … »; in HTML use <_array>/< _ii data-_index="…">; indices contiguous when expressed.
_obj vs _elem: object clusters (>) vs element clusters (/>):
HSON: closer > means _obj; closer /> means _elem.
HTML: never emit literal _elem; keep _obj literal for JSON-origin content.
Strings vs values: quoted strings → _str; unquoted literals recognized as number|boolean|null → _val.
Reserved meta keys: only explicit whitelist lives in _meta. Future runtime-only fields can be ignored by comparator if needed.
Error hygiene: literal <_elem> rejected; illegal meta on wrong nodes rejected; _val must be exactly one primitive.
10) Plan for the HSON tokenizer/parser/serializer (NEW)
File layout (mirror HTML/JSON):
Wrappers (public): src/api/parsers/parse-hson.transform.hson.ts, src/api/serializers/serialize-hson.render.hson.ts.
OLD impl: src/old/.../parse-hson.old.*, serialize-hson.old.*.
NEW impl: src/new/.../parse-hson.new.*, serialize-hson.new.*.
Shadow: wrappers return OLD; when SHADOW_TEST, also run NEW → toOLD → compare/diff.
Tokenizer (NEW):
Small deterministic scanner; tokens for <, >, />, tag names, attr names, =, quoted strings (with escapes), guillemets « », commas, raw text, whitespace.
No coercion here; the parser decides _str vs _val.
Rich errors (position, expected set).
Parser (NEW):
Enforce closers: > ⇒ _obj, /> ⇒ _elem.
Enforce <_array<_ii>...> shape.
Enforce _val contains one-primitive rule.
Enforce VSNs-no-attrs; meta whitelist; style→object.

Serializing changes (NEW):
Canonical HSON: always « » for arrays (brackets are accepted by the parser but serialized as guillemets); "flags" are found as key="key" in HSON, but serialized as (unquoted) ` flag `; style kebab/sorted.
Do not emit _elem in HTML.
do not emit _obj in JSON.
do not emit _elem or _obj in HSON -- the closer tags dictate that


11) Current status snapshot
JSON: NEW parse/serialize parity-checked under shadow; wrappers still return OLD. JSON believed stable.
HTML: NEW parser/serializer wired; shadow diff = clean on valid fixtures; invalid fixtures fail as intended. HTML believed stable. 
Comparators: normalized; style/flags/meta issues resolved.

Compat (toOLD): stable; no _attrs on VSNs in NEW; style bridging handled.
Logging: variadic _log with preview; diff bucketing used during triage.

12) Short “what to remember” checklist before starting HSON
Keep the wrapper/OLD/NEW pattern and shadow compare exactly as HTML/JSON.
Honor _val vs _str; don’t let numbers end up as strings.
never emit literal _elem or _obj tags
data-_index only on <_ii>, and contiguous when present; data-_quid allowed anywhere but currently not used much.
No _attrs on VSNs.
Style is parsed object in memory; kebab + sorted on wire. // TODO: if parsing fails, store as simple string as fallack
'Flags' now obsolete; now found in _attrs as `key:"key"`, serialized as value without quotes
Treat XML-style strictness in HSON too; fail fast with good messages.
Run the same comparators and diff buckets in shadow for HSON; don’t re-invent them.