
HSON — CSS Roadmap

Goals
	•	Expose CSS power without becoming a CSS framework.
	•	Keep LiveTree ergonomic for animation, styling, and interactivity.
	•	Avoid global side effects, specificity hell, and unbounded selectors.

⸻

1. Define the CSS Scope

HSON may touch only three CSS surfaces:
	1.	Class manipulations
	2.	Inline style access via LiveTree’s style façade
	3.	A scoped <style> bucket owned by each LiveTree root

Nothing else—no global stylesheet rewrites, no universal selectors.

⸻

2. Solidify LiveTree class/style helpers

These stay simple and predictable:
	•	branch.select(...).classList.add/remove/toggle
	•	branch.select(...).style.set(name, value)

The style façade should:
	•	normalize transforms,
	•	batch writes,
	•	provide a safe default epsilon,
	•	avoid writing raw strings repeatedly.

⸻

3. Introduce a per-branch <style> bucket

Each LiveTree root gets a lazily-created, HSON-managed style tag:

<style data-hson-style="root-quid"></style>

All HSON-injected CSS goes here.
All rules are auto-scoped to this root, e.g.:

[data-hson-root="abc"] .button { … }

This prevents global pollution and specificity accidents.

⸻

4. Add a minimal CSSOM helper

Expose one tiny object:

branch.stylesheet.addRule(selector, cssText)
branch.stylesheet.removeRule(id)
branch.stylesheet.ensureKeyframes(name, cssText)

This writes only to the branch’s scoped <style> bucket.
No ability to reach outside the scope.
No writing global @rules.

⸻

5. First “fancy CSS” feature: keyframes

Keyframes are the most valuable + least dangerous advanced feature.
	•	Provide a simple way to ensure a named keyframe exists.
	•	Let the user activate animations by toggling classes.
	•	Keep everything scoped.

This solves animation ergonomics without hson.animate().

⸻

6. Phase 2 (later): @property and CSS vars

Only after the basics are stable:
	•	optional CSS custom property registration,
	•	CSS variables as data channels,
	•	a small “theme” map (branch.theme.set("hue", 215) → writes --hson-hue).

This unlocks reactive CSS without exploding your API.

⸻

7. Error handling + docs
	•	Warn loudly on invalid selectors, unsafe rules, or attempts at global CSS.
	•	Provide clear JSDoc:
	•	what is scoped,
	•	what isn’t allowed,
	•	why this avoids specificity/override problems.

⸻

Summary

The CSS roadmap is:
	1.	Finalize class/style helpers.
	2.	Add scoped <style> buckets per LiveTree.
	3.	Add a minimal CSSOM interface that only touches that bucket.
	4.	Implement keyframe helpers for animation ergonomics.
	5.	Much later: controlled @property and CSS var integration.

This gives HSON modern, powerful CSS access with minimal API bloat and zero risk of becoming a CSS framework.