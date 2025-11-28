

LiveTree Refactor & Hardening — Summary

1. Rebuilt the internal model for style handling

Brittle, string-based style implementation (a leftover from early HSON 1.x) relied on splitting and re-joining inline CSS and often left the node model and DOM out of sync.
We replaced it with a strict, canonicalized approach:
	•	Node-side _attrs.style always stores a Record<string,string>
(except when style is fully removed, then it’s undefined).
	•	Parsing HTML into HSON now normalizes inline style into that same object form.
	•	All string parsing and joining is handled in two dedicated helpers:
	•	parse_style_string()
	•	serialize_style()
	•	LiveTree no longer directly splits or concatenates CSS anywhere.

This closed a long-standing source of inconsistency between DOM and HSON nodes and made style operations predictable.

⸻

2. Rewrote the StyleManager operations (css, cssReplace, remove)

All three operations now operate on a single consistent representation:
	•	css({...}) merges into the existing style object.
	•	cssReplace({...}) discards everything and installs exactly one new object.
	•	remove("prop") deletes one property and removes the entire style attribute if empty.

DOM and node always remain identical after each operation.

This fixed the original errors (before.split is not a function) and stabilized a whole class of brittle edge cases.

⸻

3. Resolved TypeScript typing and internal invariants

During the refactor the compiler surfaced several root issues:
	•	The old style type allowed both string and object; we eliminated the string case.
	•	Indexing warnings in TS were resolved via Record<StyleKey,string> and explicit casts for arbitrary CSS custom props.
	•	Fixed an access of a private method (withNodes) by routing all mutation through the supported public channels.

This tightened LiveTree’s internal invariants and removed hidden footguns.

⸻

4. Repaired append semantics and introduced appendMany()

A structural flaw surfaced:
	•	Appending multiple branches was accidentally treated as “multiple roots,” triggering an old fail-safe (expected a single root, got 2; using first) from before the DI/Branch system existed.
	•	The node model ended up with a _str wrapper instead of the raw primitive, causing the failing assertion.

We rebuilt this whole path:
	•	append() now accepts a Branch or a value array (Branch[]).
	•	A new appendMany() helper explicitly accepts arrays.
	•	Under the covers, each item is appended separately, preserving order.
	•	No silent fallback to the “first root.”
	•	The node and DOM now stay perfectly in sync for all multi-append cases.

⸻

5. Rebuilt find and findAll to be sane

Previously:
	•	find(".selector") sometimes returned an empty pseudo-LiveTree.
	•	findAll returned an array (untyped mixture of Node, LiveTree, nulls).
	•	The semantics were mismatched across HSON and HTML queries.

Now:
	•	find(selector) → LiveTree | undefined
(no fake empty branch).
	•	findAll(selector) → MultiResult
(always a defined object; can hold zero or more branches).
	•	Order matches DOM order.
	•	.must() is used only in the test suite, not in the library.

This aligned selection semantics with modern JS expectations and cleaned up a major historical inconsistency.

⸻

6. Strengthened the LiveTree → DOM → node lockstep guarantees

All tests now assert full equivalence between:
	•	serialized node style
	•	serialized DOM style
	•	DOM tree shape
	•	node model shape

And this is not superficial—it’s structural:
	•	We ensure the same child order.
	•	We ensure attributes shuffle identically after every operation.
	•	Append and empty operations mutate both sides symmetrically.

This moves LiveTree much closer to the reliability of a virtual-DOM engine, but without the diffing layer.

⸻

7. Added a suite of new invariance tests

The test suite grew substantially. We now have explicit coverage for:
	•	Style merging
	•	Style replacing
	•	Style removal
	•	Mixed inline/LiveTree style memory
	•	append/appendMany
	•	Empty-then-append
	•	Dataset operations and removal semantics
	•	find/findAll correctness
	•	Preservation of DOM order in multi-append
	•	Safety around returning undefined for missing selectors

This gives you a solid, automated “contract” for the LiveTree public API.

⸻

8. Removed legacy behavior that was silently degrading correctness

A few historical behaviors were eliminated:
	•	The silent “multiple root fallback” in createBranchFromNode.
	•	The wrong assumption that node styles might still be strings.
	•	The pseudo-LiveTree return from failed find operations.
	•	Unintended coercions of HSON primitive leaves into _str wrappers.

Removing them made LiveTree both safer and easier to reason about.

⸻

Net Result

This session completed the single largest stabilization of LiveTree since your 2024 hardening pass.

You now have:
	•	Clean, predictable selection
	•	Robust append semantics
	•	Full style canonicalization
	•	Identical DOM/HSON behavior
	•	Strict typing enforcing invariants
	•	A much richer test suite that verifies every public operation

This is the exact kind of foundation LiveMap will require, especially as it starts generating LiveTree branches at scale and relying on precise append/replace behavior.

Everything done here removes unpredictable edges and brings the LiveTree engine fully into alignment with the rest of HSON 2.0.25: a stable, declarative runtime with no hidden state and no surprising conversions.