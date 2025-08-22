HSON Refactor Progress Log (shadow-cutover, NEW/OLD split)
0) Repo split, exports, and public surface
Directory split: created src/old/ (frozen), src/new/ (refactor targets), kept public wrappers in the original paths under src/api/....
Exports: restored a stable top-level index that re-exports the public API (hson.transform, hson.liveTree) and types used by tests (HsonNode, etc.). Avoid deep imports; all consumers use the top barrel.
Package “exports” map: still points to built dist/index.*. Types flow through the barrel; tests don’t reach into deep file paths.
Why: lets us swap internals without breaking dependents. Wrappers always return OLD; NEW runs in shadow for parity.
1) Shadow mode: wrappers + comparators
Wrappers (HTML & JSON finished; HSON next): public parse_*/serialize_* remain in old locations but:
Call *_OLD, return its result.
If SHADOW_TEST is true, also run *_NEW, convert to OLD via toOLD, compare via equal_old_nodes; if not equal, log diff_old_nodes (small path list).
Shadow flag: SHADOW_TEST = Boolean(globalThis.test_new) (works in page consoles and tests).
Comparator normalization:
Canonical JSON stringifier for equality (sorted keys).
Style normalization (see below).
Unified _attrs view for OLD vs NEW (pulls from OLD meta.attrs + flags, and from NEW _attrs).
Reserved meta is singled out (data-index, data-quid); test comparator can include or ignore them depending on what we’re validating.
Why: safe strangler-fig migration with visibility into real diffs.
2) NEW node model decisions (authoritative)
User attributes → NEW _attrs (strings + flags as key:"key", style as object).
System metadata → NEW _meta (whitelist today: data-index, data-quid).
Wire mapping (HTML/HSON):
_meta['data-index'] ⇄ data-_index
_meta['data-quid'] ⇄ data-_quid
VSNs carry no _attrs (only standard tags do). <_ii> may carry _meta for index.
Do not emit literal <_elem> in HTML; unwrap its children. <_obj> does stay on wire from JSON-sourced content (see §5).
Why: removes user/system bleed-through; gives us stable, explicit structure across formats.
3) HTML parser (NEW) brought to parity
Initial symptoms we fixed
Standard tags fell through a default path; numbers sometimes became _str nodes.
Style attributes mismatched (font-size vs fontsize); hyphen logic was inconsistent.
Index meta showed up under _attrs instead of _meta.
Boolean flags weren’t canonicalized uniformly on read/write.
data-_quid wasn’t round-tripping.
Key fixes
Child collection: elementToNode returns raw primitives for text nodes and nodes for elements. No wrapper VSNs added here.
Primitive wrapping: after collecting children, wrap primitives:
if primitive is a string → _str
else (number|boolean|null) → _val
Strict _val shape: _val must contain exactly one primitive. If it contains _str, unwrap its string; if it contains _val, unwrap one layer; otherwise error.
Attributes ingestion (parse side):
Walk all DOM attributes preserving case for values; compare names case-insensitively.
data-_index → _meta['data-index'] (strings); data-_quid → _meta['data-quid'].
style parsed to an object (existing parse_css_attrs).
Flags canonicalized in-memory as key:"key" when value is "" or repeats the name.
Sorted, stable key order for determinism.
Invalid inputs rejected: literal <_elem> in user HTML; VSNs carrying _attrs; _array children not all <_ii>; <_ii> with ≠1 child; non-<_ii> carrying data-_index.
XML vs HTML reality: we intentionally feed XML to support underscore tags and stricter errors. Inputs not legal XML (e.g., unquoted numeric attributes, raw & in values) are considered invalid (test samples marked as such).
Outcome: HTML shadow diffs went to zero (after the style/flags/index mapping fixes).
4) HTML serializer (NEW) to parity
Wire helpers:
Build wire attrs from NEW _attrs plus whitelisted _meta (map data-index→data-_index, only on <_ii>; data-quid→data-_quid on any tag).
Escape attr values safely.
style object serialized to kebab, sorted, key:value; ….
Emit bare boolean flags on HTML (i.e., disabled, not disabled="disabled").
VSN handling:
_elem flattens (not emitted).
_str emits escaped text.
_val emits the primitive (numbers/booleans/null as text; strings escaped).
_obj is kept literal on wire (see §5).
Void elements: per your rule: self-close in HTML as <img />.
Outcome: serializer parity warnings (including data-_quid) vanished once parse/serialize wired the meta mapping symmetrically.
5) JSON ↔ HTML invariants (and why you saw _obj in HTML)
JSON → HsonNode: generic objects always produce an _obj VSN; arrays produce _array containing <_ii>; primitive values go to _val; strings to _str.
JSON → HTML: the _obj wrapper is intentionally preserved in HTML output. Reason: when HTML is read back in, we need to disambiguate object clusters (_obj) from element clusters (_elem). We never emit _elem; HTML itself implies _elem, but _obj must remain explicit.
Arrays in HTML: explicit only. We do not infer arrays from repeated siblings; HTML must contain <_array>…<_ii data-_index="…">…</_ii>…</_array>. Gapped/missing indices are invalid.
Outcome: the “number vs object” mismatch came from wrapping numeric text as _str instead of _val; corrected by the primitive wrapping fix and _val shape enforcement.
6) Comparator & diff quality-of-life
equal_old_nodes: normalizes OLD vs NEW into a stable, JSON-serializable shape:
Unified attrs (NEW _attrs + OLD meta.attrs + OLD flags→key:"key").
Style normalized (string→object, kebab, sorted).
Reserved meta retained as strings (or optionally ignored for specific checks).
Stable key order; canonical serialization.
diff_old_nodes: best-effort path diffs with a cap; we added a tiny “bucket view” during triage to group common endings (e.g., ._attrs.style.*, ._meta.data-index, flags).
Preview logging: variadic logger with truncation for long strings.
Outcome: we chased families of issues instead of one-offs; this is what let us flatten the error count quickly.
7) toOLD compat
Goal: NEW → OLD shape for fair comparison and for any legacy callers.
Rules implemented:
Copy NEW _attrs into OLD meta.attrs.
Convert flags (key:"key") to OLD meta.flags (string entries).
Preserve NEW _meta keys (e.g., data-index, data-quid) on OLD meta (strings).
Ensure VSNs carry no _attrs; attrs live under OLD meta.attrs.
If needed by OLD call sites, style object is converted to the canonical CSS string before landing in OLD meta.attrs.style.
Outcome: we eliminated class of diffs caused by NEW keeping user attrs separate from meta.
8) Test fixtures & coverage (HTML side)
We augmented your fixtures with targeted cases that flushed out edge mismatches:
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
Enforce _array/<_ii> shape.
Enforce _val one-primitive rule.
Enforce VSNs-no-attrs; meta whitelist; style→object.
Serializer (NEW):
Canonical HSON: always « » for arrays; flags as key="key" in HSON; style kebab/sorted.
Do not emit _elem.
Keep _obj literal in HSON.
Fixtures: add a compact HSON set that exercises each invariant above (including failure cases), in addition to your existing HTML/JSON round-trips.
11) Current status snapshot
JSON: NEW parse/serialize parity-checked under shadow; wrappers still return OLD.
HTML: NEW parser/serializer wired; shadow diff = clean on valid fixtures; invalid fixtures fail as intended.
Comparators: normalized; style/flags/meta issues resolved.
Compat (toOLD): stable; no _attrs on VSNs in NEW; style bridging handled.
Logging: variadic _log with preview; diff bucketing used during triage.
12) Short “what to remember” checklist before starting HSON
Keep the wrapper/OLD/NEW pattern and shadow compare exactly as HTML/JSON.
Honor _val vs _str; don’t let numbers end up as strings.
Preserve _obj on wire; never emit literal _elem.
data-_index only on <_ii>, and contiguous when present; data-_quid allowed anywhere.
No _attrs on VSNs.
Style is object in memory; kebab + sorted on wire.
Flags canonical in memory as key:"key", bare on HTML.
Treat XML-style strictness in HSON too; fail fast with good messages.
Run the same comparators and diff buckets in shadow for HSON; don’t re-invent them.