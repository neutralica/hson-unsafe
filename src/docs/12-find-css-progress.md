Progress summary: tighter selection/return semantics, strongly tested append/attrs behavior, a more disciplined dataset API, structured CSS values, and a fully specified, singleton CSSManager wired to a dedicated <hson-_style> container.

1. LiveTree selection / reference model

Core idea: a “selection” is now a proper object, not a loose node.
	•	Ref object = LiveTree instance
	•	find(selector: string | SelectorSpec): LiveTree | null
Returns a LiveTree whose internal selection state is the match (or null if no match).
	•	must(selector: ...): LiveTree
Same as find, but throws if there is no match.
	•	Internally, both rely on a helper along the lines of findWithById(...) that:
	•	Resolves the DOM node (often via QUID / data-_quid or similar).
	•	Resolves the corresponding HsonNode.
	•	Constructs a LiveTree with that pair as its “ref”.
So the “ref type” in this system is explicitly LiveTree, not a raw DOM or HSON node.
	•	Multi-selection = MultiResult<LiveTree>
	•	findAll(selector: ...): MultiResult<LiveTree>
	•	Wraps an array of LiveTree selections.
	•	Provides helpers like .each(fn), .first, etc.
	•	Empty result → an empty MultiResult, never null, so callers don’t need a separate “did this become a list vs nothing” branch.
	•	Contracts solidified & tested
	•	Tests called things like:
	•	LiveTree find/findAll: hits, misses, and empty MultiResult
	•	LiveTree find vs must vs findAll contracts
	•	LiveTree sourceNode(true) returns a snapshot, false returns live node
	•	This encodes the guarantees:
	•	find may return null, must may throw, findAll always returns a MultiResult.
	•	sourceNode(true) gives an immutable snapshot (for diffing), sourceNode(false) gives the live node wired to DOM changes.

⸻

2. Append / appendMany semantics

Goal: safely mutate DOM+HSON structure while preserving order and avoiding surprises.
	•	Single-child append:
	•	An “empty + append” path uses something like:

tree.empty().append(child);

and tests assert that:
	•	The HsonNode subtree under the selection matches the expected structure.
	•	The DOM subtree under the corresponding element matches that same structure.

	•	This is visible in logs:
	•	[LiveTree debug] empty+append node: {...}
	•	[LiveTree debug] empty+append DOM: <section ...>...</section>

	•	Multi-append: appendMany (or equivalent)
	•	Test fixture:
	•	Start with <p class="orig">one</p>
	•	Append two more paragraphs "two" and "three" as new siblings.
	•	Expectations:
	•	Node side: _content becomes [orig, new-1, new-2].
	•	DOM side: <p class="orig">one</p><p class="new-1">two</p><p class="new-2">three</p>.
	•	Tests:
	•	LiveTree full: append multiple children preserves order (node + DOM)
	•	LiveTree appendMany([]) is a no-op
	•	This enforces:
	•	Multiple children are appended in order.
	•	Passing an empty array does nothing (no stray mutations, no errors).

⸻

3. StyleManager (inline styles on elements)

Scope: per-selection manipulation of style="", synced between node and DOM.
	•	APIs (from the tests & logs):
	•	css(styleStringOrObject)
	•	Merges new declarations into any existing inline style on the node/element.
	•	cssReplace(styleStringOrObject)
	•	Replaces the entire inline style with the new set.
	•	remove("propName")
	•	Removes individual style props.
	•	Behavior verified by tests:
	•	LiveTree full: StyleManager css + cssReplace
	•	css merges new declarations, leaving unrelated ones intact.
	•	cssReplace blows away old declarations and installs only the new ones.
	•	LiveTree StyleManager merges with pre-existing inline style
	•	Starting with a pre-existing inline like "color: red", merging new style keeps color: red and adds/overrides the new props.
	•	StyleManager: css merge vs cssReplace semantics
	•	Explicit test of those two behaviors.
	•	StyleManager: supports CSS variables and numeric values
	•	Demonstrates support for things like:
	•	--bg: #123
	•	Numeric values (e.g. width: 100 → "100px" or similar; the exact mapping is handled inside).
	•	Node + DOM synchronization:
	•	Debug outputs show nodeStyle1 and domStyle1 matching exactly.
	•	After updates and removals, both node _attrs.style and element.style stay aligned.

⸻

4. DatasetManager (data-* management, including multi-set)

Goal: treat data-* as a typed, declarative API, synced with HSON attrs.
	•	Core behavior:
	•	Single-key set:
	•	data.set("state", "open") → sets data-state="open" in DOM and node attrs.
	•	Updates / removals:
	•	Setting a key to null or undefined removes the corresponding data-* attribute.
	•	Tests:
	•	LiveTree full: DatasetManager set/get mirrors data-* attrs
	•	DatasetManager: null/undefined removes data-* keys
	•	Confirms removal on both DOM and node sides.
	•	setMany with typed values and key normalization:
	•	Input shape:

setMany({
  state: "open",
  userId: 123,
  flag: "on",
  temp: null, // remove
});


	•	Implementation details:
	•	Accepts a Record<string, CssValueLike> or Record<string, string | number | boolean | null | undefined> (you used a HsonAttrs-like shape at one point, then tightened it).
	•	Uses your existing camel_to_kebab / kebab_to_camel helpers so that:
	•	Keys like userId become data-user-id in the DOM.
	•	Values:
	•	null / undefined → attribute removal.
	•	string | number | boolean → stringified and written to data-*.
	•	Tests:
	•	DatasetManager setMany: multi-set, stringification, and removals stay in sync
	•	Confirms:
	•	userId: 123 ends up as data-user-id="123".
	•	nulls remove keys.
	•	Node _attrs and DOM dataset / data-* stay consistent.

⸻

5. CSS value typing (CssUnit, CssValue)

Purpose: allow higher-level helpers to do math and unit-aware modifications.
	•	Types:

export type CssUnit =
  | "px"
  | "em"
  | "rem"
  | "%"
  | "vh"
  | "vw"
  | "s"
  | "ms"
  | "deg"
  | "_"; // unitless

export type CssValue =
  | string
  | { value: number; unit: CssUnit };


	•	Helper:

function renderCssValue(v: CssValue): string {
  if (typeof v === "string") {
    return v.trim();
  }
  const unit = v.unit === "_" ? "" : v.unit;
  return `${v.value}${unit}`;
}


	•	This powers the “structured rule” APIs in CssManager:
	•	Callers can use either:
	•	Raw CSS strings: "10px", "rotate(45deg)", "var(--foo)".
	•	Structured numeric values: { value: 2, unit: "rem" }.
	•	Internally everything is rendered to plain CSS text before hitting the <style> tag.

⸻

6. CssManager: global stylesheet singleton

Goal: one controlled HSON-owned stylesheet, separate from inline styles on elements.

6.1 Types
	•	Stored representation:

export interface CssText {
  id: string; // key in the Map
  css: string; // full rule text, e.g. `* { background-color: red; }`
}


	•	Structured call shape:

export interface CssRule {
  id: string;
  selector: string; // "*", ".foo", "[_hson-flag]" etc.
  body: string;     // "background-color: red;"
}


	•	Optional helpers:

export type CssProp = Record<string, CssValue>;

export type CssRuleBlock = {
  selector: string;
  declarations: CssProp;
};

Plus stubs for future @keyframes / @property blocks:
	•	KeyframesBlock
	•	PropertyBlock

6.2 Singleton + DOM anchoring
	•	Singleton pattern:

export class CssManager {
  private static instance: CssManager | null = null;
  private readonly rules: Map<string, CssText> = new Map();
  private styleEl: HTMLStyleElement | null = null;

  private constructor() {}

  public static invoke(): CssManager {
    if (!CssManager.instance) {
      CssManager.instance = new CssManager();
    }
    return CssManager.instance;
  }
}


	•	DOM structure (ensured lazily):

<hson-_style id="css-manager">
  <style id="_hson">/* generated rules */</style>
</hson-_style>


	•	ensureStyleElement():
	•	Looks for hson-_style#css-manager; creates it under document.body if missing.
	•	Within that, looks for style#_hson; creates it if needed.
	•	Caches the HTMLStyleElement in this.styleEl.

6.3 Rule definition APIs
	•	String-style rule:

public defineRuleString(input: CssRule): void {
  const id = input.id.trim();
  const selector = input.selector.trim();
  const body = input.body.trim();

  if (!id)       throw new Error("CssManager.defineRuleString: id must be non-empty");
  if (!selector) throw new Error(`CssManager.defineRuleString(${id}): selector must be non-empty`);
  if (!body)     throw new Error(`CssManager.defineRuleString(${id}): body must be non-empty; use removeRule() to delete rules.`);

  const css = `${selector} { ${body} }`;

  this.rules.set(id, { id, css });
  this.syncToDom();
}

Example:

fleurLayer.css.defineRuleString({
  id: "back-color",
  selector: "*",
  body: "background-color: red;",
});


	•	Block-style rule (typed values):

public defineRuleBlock(
  id: string,
  selector: string,
  decls: Record<string, CssValue>,
): void {
  const parts: string[] = [];
  for (const [prop, v] of Object.entries(decls)) {
    parts.push(`${prop}: ${renderCssValue(v)};`);
  }
  const body = parts.join(" ");
  this.defineRuleString({ id, selector, body });
}

Example:

fleurLayer.css.defineRuleBlock("back-color", "*", {
  backgroundColor: "red",
  opacity: { value: 0.5, unit: "_" },
});


	•	Atomic rule helper:

public defineAtomicRule(
  id: string,
  selector: string,
  property: string,
  value: CssValue,
): void {
  this.defineRuleBlock(id, selector, { [property]: value });
}



6.4 Deletion and syncing
	•	Removal:

public removeRule(id: string): void {
  if (!this.rules.has(id)) return;
  this.rules.delete(id);
  this.syncToDom();
}

public clearAll(): void {
  if (this.rules.size === 0) return;
  this.rules.clear();
  this.syncToDom();
}


	•	Sync down to <style>:

private buildCombinedCss(): string {
  const parts: string[] = [];
  for (const rule of this.rules.values()) {
    const css = rule.css.trim();
    if (!css) continue;
    parts.push(css);
  }
  return parts.join("\n\n");
}

private syncToDom(): void {
  const styleEl = this.ensureStyleElement();
  styleEl.textContent = this.buildCombinedCss();
}


	•	LiveTree integration:

get css(): CssManager {
  return CssManager.invoke();
}

So any LiveTree selection can reach the global stylesheet via .css, but CssManager itself is global, not per-selection.

⸻
