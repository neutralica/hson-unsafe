HSON API next steps

>>> NOW


- redesign the liveTree API
from: hson.liveTree(element) // directly pass the elemtn to liveTree itself

to: explicit, deliberate, chainable (much like transform)

hson.liveTree.graft(element): default safe

hson.liveTree.unsafeGraft(element): unsafe, for use on trusted internal data only

hson.liveTree.graftBody() / unsafeGraftBody(): instead of defaulting to document.body, force a decision from the point of call

<!-- 
- "limb"/"branch" creation ("bough"?)

goal: create a liveTree instance directly from any valid data source (*is this a good idea??? what if just some random json is passed? error and what?*)
    - currently, one must pass an element queried from the DOM to hson.liveTree. liveTree ingests it and returns the tree, grafted to the parent of the passed element, replacing it
    
    this actually ight be fine?



implementation:

Add methods like hson.liveTree.fromHTML(htmlString) and hson.liveTree.fromJSON(jsonString). These will return a new, detached liveTree instance.

Enhance the .append() method on existing trees to recognize when it's being passed another liveTree instance and intelligently "graft" its nodes, DOM elements, and internal maps.
// I think it might already do this
     -->
Expose Raw DOM Elements for Event Listeners

Goal: Allow developers to get the underlying HTMLElement from a liveTree instance to attach event listeners.

Implementation: Add a method like .raw() to the liveTree API that returns the corresponding live DOM element.

⏳ Defer for Later

These are valuable ideas that are not critical right now but should be on the roadmap for future versions.

A Fluent Transformer on Live Trees

Idea: Add a context-aware transform pipeline directly to liveTree instances, e.g., myTree.transform.fromJSON(data).append().

Reason to Defer: The "Detached Limbs" approach (hson.liveTree.fromJSON(...) followed by myTree.append(...)) is more powerful and covers this use case effectively for now. This can be revisited later as a potential "syntactic sugar" enhancement.

Live Variable References in Data

Idea: Have JSON data directly reference live JavaScript variables.

Reason to Defer: This is a fundamental limitation of JSON itself. The correct pattern is using a templating system (e.g., string placeholders like {{myVar}}) to inject data before parsing. While important, this is a usage pattern, not a direct change to the HSON API.

❌ Decided Against

These were initial ideas that we refined or replaced with better solutions.

A Global hson.unsafe Mode

Idea: A top-level switch to make the entire library operate in an unsafe mode.

Reasoning: We decided it was much clearer and safer to handle the unsafe opt-in at the method level (e.g., unsafeGraft) rather than with a persistent global mode.

A "Smart" .append() Method

Idea: An append() method that automatically detects the input type (HTML, JSON, etc.) and processes it accordingly.

Reasoning: We agreed that this was too "magical" and implicit. An explicit API (hson.liveTree.fromJSON(...)) is clearer, more predictable, and less prone to error.