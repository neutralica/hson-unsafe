LiveTree CSS Control Panel — Candidate Features
A. Keyframes and Animation Utilities
These are the ones we already circled.
Dynamic keyframe injection
tree.css.addKeyframes(name, rules)
tree.css.ensureKeyframes(name, rules)
Rule injection
tree.css.addRule(selector, rules)
tree.css.ensureRule(selector, rules)
Inline animation façade
node.animateCSS(name, opts?)
(writes animation: shorthand; trivial, powerful)
Optional: restart helper
node.animateCSS.restart(name)
(common CSS quirk—forcing replay of an animation)
This is enough to make “CSS animation from JS” frictionless.
B. Typed Custom Properties (@property)
One of the biggest underused features.
CSS variable registration
tree.css.registerProperty(name, { syntax, initial, inherits })
Node-scoped variable helpers
node.cssVar.set("--foo", "10px")
node.cssVar.setNumber("--foo", 10, "px")
node.cssVar.get("--foo")
Reasoning:
Typed properties + CSS transitions = absurdly clean motion.
C. Attribute-Based State Helpers
CSS’s new selectors (:has, :is, :where) make attributes very expressive.
LiveTree can standardize how state goes into the DOM:
node.state.set("expanded", true) → data-state-expanded="true"
node.state.set("error") → data-state-error="true"
node.state.unset("expanded")
This makes CSS rule-writing predictable:
.card[data-state-expanded="true"] { /* ... */ }
.card:has([data-state-error]) { border: red solid 1px; }
No logic inside LiveTree; just clear declarative state.
D. Container Query Helpers
Container queries are amazing but fiddly to wire up.
Helpers:
node.container.enable({ name: "card", type: "inline-size" })
emits inline container-type / container-name
Optional rule injection:
tree.css.addContainerRule("card", "(min-width: 40rem)", rules)
This unlocks responsive components without media queries.
E. Scroll / Animation Timeline Helpers
(Optional, cutting edge)
These are becoming part of CSS but are verbose in CSSOM.
tree.css.defineScrollTimeline(name, { source, axis })
node.animateCSS(name, { timeline: "scrollTimelineName" })
Scroll-linked motion without JS animation loops.
F. CSS Layers (@layer)
Good for controlling specificity and making sure injected rules behave.
tree.css.ensureLayer("livetree")
All LiveTree-injected rules nest under:
@layer livetree {
  /* injected rules… */
}
This protects user CSS from being accidentally overridden.
G. Selection Operations
(Selector-based DOM selection, not CSS rules)
Already fits your LiveTree model:
tree.select(selector)
.style({...})
.class.add(), .class.toggle()
.attr.set()
This blends beautifully with rule injection: define a runtime rule → then target nodes via tree.select.
H. Low-level CSSOM Exposure (opt-in)
Expose raw access for advanced callers:
tree.css.sheet → underlying CSSStyleSheet
tree.css.insertRule(ruleText)
tree.css.deleteRule(index)
Not for beginners, but powerful for people who want direct control without rummaging in the DOM.