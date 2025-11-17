🧩 Phase 1 – Security & Hardening Refactor (earlier half)

Core Objectives
Eliminate unsafe coercions and non-deterministic parse paths.
Replace heuristic “best guesses” with explicit mode semantics.
Ensure every token type, VSN, and closer produces predictable structure.
Seal potential prototype pollution and attribute-leak paths.

-- Implemented

TokenKind tightening

Added explicit discriminated union for TokenKind: OPEN, CLOSE, ARR_OPEN, ARR_CLOSE, TEXT, and later EMPTY_OBJ.

Removed any string fallthroughs and replaced any returns with type-safe overloads for _take().

_take() / _peek() audit
_take(expected?: TokenKind) now validates kind at runtime, throwing via _throw_transform_err on mismatch.

Added specific overloads returning TokenOpen | TokenClose | TokenArrayOpen | TokenArrayClose | TokenText.
decode_json_string_literal() safety
Hardened against malformed \uXXXX escapes; fallback preserves literal.
Limited backslash decodes to canonical JSON escapes (n, r, t, b, f, ", ', \, /).
split_attrs_meta() isolation
Prevented attributes from leaking into _meta.
Confirmed that attribute reflection honors only whitelisted data-prefixes (and never arbitrary keys).
Result/Error unification
All parser exceptions now throw standardized ErrReports through _throw_transform_err, giving source, tag, and context.
Meta-prop canonicalization
Enforced internal _DATA_QUID, _DATA_INDEX, etc., to prevent name collision with user props.
Primitive leaf handling
Consolidated _str vs _val semantics.
Ensured numeric/string coercion follows same rule set between JSON and HSON.
⚙️ Phase 2 – Parser Structural Overhaul (this chat)
Problems Diagnosed
_elem wrappers were disappearing during parse → serialize round-trips.
Top-level nodes were written directly to nodes[] from inside nested readTag() loops, flattening tree depth.
Root fallback heuristics (unique tag names → _obj) produced divergent topologies between JSON and HTML inputs.
sawClose typing collapse (never) hid real logic gaps.
As a result: JSON fixtures emitted _elem where _obj was expected, causing “1 vs 2 child” mismatches.
Solutions Implemented
readTag() rebuilt as a local recursive parser
All child tokens now push into kids, never the global nodes.
Added explicit CLOSE branch:
if (isTokenClose(t)) { sawClose = _take(TOKEN_KIND.CLOSE); break; }
Guarded sawClose null check, producing explicit CloseKind.
Top-level driver owns topCloseKinds tracking
Each top-level OPEN/ARR_OPEN/TEXT now records its closer mode (obj or elem), feeding into root resolution.
EMPTY_OBJ token integrated
Added overload and runtime handling for the shorthand <> to produce an empty _obj cluster.
This fixed prior “dangling <>” crashes and unified it with JSON’s {}.
Implicit-root fallback redesigned
Removed the unique-tag heuristic entirely.
New logic: pick _obj if all closers are obj, _elem if all are elem, else default to _elem.
Guarantees parity between JSON and HTML-origin trees.
Type safety cleanup
_take() overloads extended to include TOKEN_KIND.TEXT and TOKEN_KIND.EMPTY_OBJ, silencing 18047/2339 compiler warnings.
Replaced stray any usage with proper discriminants.
Serializer symmetry check (sanity pass)
Verified serialize_hson_NEW.emitNode() respects VSN neutrality: _obj/_elem clusters are emitted, not invented.
Ensured no attribute emission from VSNs.
 Discoveries & Design Insights
Closer semantics as truth source → not only safer, but philosophically aligned with HSON’s goal: HTML and JSON are the same tree described in two dialects.
Elimination of “unique key” heuristics was crucial; JSON uniqueness is already enforced structurally, not by observation.
Parser purity: by quarantining recursion inside readTag(), HSON’s parse becomes fully deterministic and side-effect-free.
Resulting parity: round-trips now yield bit-identical _root → _obj/_elem hierarchies across all three formats (HTML ↔ HSON ↔ JSON).
 Final State
All fixtures pass (HTML, JSON, HSON).
Parser/serializer are isomorphic.
Security guarantees: no unsafe fallbacks, no dynamic tag guessing, no type leakage.


The structural loop of the HSON ecosystem has been closed. The tree grammar is now fully deterministic, error-safe, and format-neutral.