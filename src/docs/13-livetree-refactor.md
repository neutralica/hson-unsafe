LiveTree v1 is fully retired
	•	All v1 methods are disabled, commented out, or bypassed.
	•	No code path in the test suite hits the old classes.
	•	Every operation—mutation, selection, styling, dataset, event listeners, creation, append, root mount—runs through LiveTree2.
	•	Even the “LiveTree full” test name is just a legacy label in the fixture suite; it is executing LT2 since the old LT is not callable anymore.

Nothing in the current system dispatches through the v1 methods.

Why this matters:
You now have one consistent tree abstraction with a coherent mental model. There’s no shadow double-binding, no split maintenance burden, no silent fallback to old behavior. The API surface is unified and enforceable.

⸻

LiveTree2 is stable enough to serve as the canonical API

Across this conversation, the last missing LT1 fallback paths were replaced:
	•	StyleManager → v2 internals
	•	DatasetManager → v2 internals
	•	setAttrs, setFlags, removeFlags, removeAttrs → v2
	•	Selector semantics → v2
	•	Multi-listener builder → v2
	•	Creation API → v2
	•	Append logic + unwrap_root_elem → v2
	•	IR mutation → v2
	•	Mount synchronization → v2
	•	CSS manager → v2
	•	Tests validate only v2 invariants

There’s nothing left inside LiveTree2 that leans on legacy compatibility.

And the success of the full test suite confirms that you haven’t just bluntly cut the old LiveTree out—you replaced it with something stricter and cleaner, and verified it down to the behavioral level.
The remaining references to “LiveTree” are purely textual
⸻

IMPLEMENTED: 

1) CSS Manager cleanup + test stabilization

You started this conversation by tightening up CssManager—its value parsing, merging, and serialization.
The system now:
	•	Accepts numbers, units, and CSS variables cleanly.
	•	Produces deterministic inline style strings.
	•	Keeps QUID-based stylesheet blocks separate per element (no merging selector lists).
	•	Survives pre-mount → post-mount transitions without losing rules.

Why this was a good decision:
This removes a chronic source of flakiness. Tests that used to randomly fail due to serialization order or mixed responsibilities are now stable and predictable.

Implication:
Inline style (imperative styling) and QUID CSS (declarative styling) now coexist with clearly defined precedence.

⸻

2) TreeSelector correctness + real broadcast semantics

The next major push was transforming TreeSelector from a “bag of LiveTree2s” into a first-class multi-branch API.

What was implemented:
	•	Broadcasted: setAttrs, setFlags, data.set, style.setMulti, css.set.
	•	Consistent chaining: All TreeSelector methods return the selector itself.
	•	Correct Selector.findAll:
The root cause of earlier test failures was your original selector string being fed into the HSON query parser, leading to zero matches. You fixed the fixture ({attrs: {class: "item"}}), and consistency returned.

Why it was a good decision:
You hardened a subtle, high-level contract:

If a method exists on LiveTree2, and it makes sense to operate on multiple elements, TreeSelector must expose a parallel operation.

That principle eliminates entire categories of ambiguity (“do we modify only the first element?”).

Implication:
LiveTree2 becomes a selector-first API rather than a single-node manipulation API. This is a shift toward DOM-like ergonomics with HSON correctness.

⸻

3) Multi-listener system

This was one of the biggest structural wins.

What exists now:
	•	A fully working ListenerBuilder for TreeSelector.
	•	Each call to selector.listen.onClick(...) fans out to N independent listeners, one per selected DOM element.
	•	Proper ListenerSub objects (off, count, ok) are generated for each attachment.
	•	Empty selections produce safe no-op builders.

Major decision:

You chose to eliminate .onEach, because it was a smell—broadcast is now the default.

Why this was a good decision:
It makes the API obvious:

A TreeSelector always acts on all selected nodes unless explicitly narrowed.

Implication:
Listeners now behave exactly like attributes and styles: one declarative action, applied to many nodes.

⸻

4) Dataset value expansion

You relaxed DatasetManager to accept numbers and other primitives, stringifying them at the boundary.

Why it was the right move:
It matches browser behavior and avoids forcing users to pre-stringify values—ergonomics improved without sacrificing determinism.

Implication:
The node IR remains clean (String(value) ensures stability), while userland gets natural types.

⸻

5) Fixes to applyAttrToNode

A foundational method got hardened:
	•	Canonical flag treatment (key="key" in IR, key="" in DOM).
	•	Correct deletion semantics (null / false → remove).
	•	Proper handling of "style" as a special case.

Why it matters:
Attributes are one of the highest-traffic mutation paths.
You cut out edge-case inconsistencies that were silently leaking through.

Implication:
Attributes now behave exactly the same whether applied before or after mounting.

⸻

6) Typed create.* system + detached branch creation

You implemented a typed creation API:

tree.create.div()
tree.create.span()
tree.create.tags(["div", "aside"])

The decisions made:
	•	create.* must produce detached branches.
	•	No auto-append.
	•	Must not recursively call tree.create or append.
	•	Must unwrap _root elements before returning.

Why it’s good:

This cleanly separates:
	•	Branch creation
	•	Branch attachment

Which mirrors both DOM APIs (document.createElement) and major VDOM libraries.

Implication:
You now have a proper component-building primitive that interacts cleanly with HSON IR and LiveTree semantics.

⸻

7) Debugging infinite recursion

You uncovered a subtle but nasty problem:
A careless wrapper around _root could recurse or hang because unwrap_root_elem was not applied, resulting in phantom container nodes.

Removing _root early during branch creation fixed the hangs and brought tests back to green.

This reinforces a big architectural rule:

No LiveTree2 should ever contain a _root tag after creation.

⸻

8) Full test suite: green wall

After all the refactors:
	•	32 tests
	•	0 failures
	•	All selectors, attrs, dataset, styles, CSSManager, listeners, append logic, and typed create API behave deterministically.

This marks a real milestone.

The suite now encodes the contracts of LiveTree2, not the behavior of an ad-hoc implementation.

⸻

9) High-level architectural implications

The library now has:
	•	A stable multi-node manipulation model (TreeSelector).
	•	Predictable two-layer styling (inline vs QUID CSS).
	•	Robust event handling across multi-selection.
	•	Well-defined IR mutation rules (attrs, flags, dataset).
	•	Typed node creation that mirrors DOM patterns but is HSON-safe.
	•	No hidden side effects between creation, mounting, and mutation.

The whole system is now much closer to:
	•	jQuery’s ergonomics
	•	React/Vue’s declarative correctness
	•	DOM’s mutation semantics
	•	HSON’s structural traceability

…without actually mimicking any one of them. It’s its own architecture.

This is the beginning of a coherent LiveTree API surface rather than a grab bag of methods.

⸻

10) Next steps (inferred from gaps you flagged)

A) createAppend replacement using typed create

You hinted at unifying createAppend with the new typed-create API. You can now design:

root.append(tree.create.div(), index)

and deprecate the stringly version.

B) More tags in HTML_TAGS

Now that typing works, expanding the tag list is trivial.

C) Event delegation (future)

The current multi-listener system is correct for direct attachment.
Delegation would be an optional, advanced layer.

D) Integration with LiveTree v1 compatibility layer

Your test suite proves LiveTree2 is stable enough to replace growing portions of LT1.

E) Template/component sugar

Typed creation opens the door to reusable, declarative components.

⸻

Final picture

What was accomplished here is unusually cohesive:
You didn’t just fix bugs—you tightened the conceptual spine of LiveTree.
	•	Uniform broadcasting semantics
	•	Uniform detachment semantics
	•	Uniform style semantics
	•	Uniform listener semantics
	•	Deterministic IR + DOM synchronization
	•	Typed creation primitives that behave like DOM but remain HSON-native
	•	A selector API that behaves exactly like users expect without traps

The refactor clarified the library’s identity:
LiveTree is becoming a small but powerful declarative-runtime layer over HSON, with DOM-literate ergonomics and IR-driven consistency.

