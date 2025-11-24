// 2-transform.docs.hson.md
#   ▌         ▗         ▐▘       
#   ▛▌▛▘▛▌▛▌  ▜▘▛▘▀▌▛▌▛▘▜▘▛▌▛▘▛▛▌
#   ▌▌▄▌▙▌▌▌▗ ▐▖▌ █▌▌▌▄▌▐ ▙▌▌ ▌▌▌
                             
       


# HSON.transform

HSON.transform is the conversion layer that parses HTML, JSON, or HSON into a single in-memory tree (HsonNode\) and serializes back out. You can use it two ways:

1. direct functions (explicit, low-level)
2. a small fluent builder (convenience chain)

Parsers return the NEW node shape and run structural checks. Serializers respect those invariants and produce stable, round-trippable output.

---

## Direct functions

### Parse

* `parse_html(input: string | Element): HsonNode`
  XML-mode HTML parse with a preflight:

  * strip HTML comments
  * expand boolean attributes to `attr="attr"`
  * escape unsafe text node content
  * normalize named entities (amp, lt, gt, quot, apos are left as-is)
  * expand void tags to `<br />` style
    Children of standard tags are wrapped in a single `_elem`. Arrays use `_arr/_ii` with `data-_index` in meta to preserve order.

* `parse_json(input: string): HsonNode`
  Strict JSON parse. Objects become `_obj` (unique child tags). Arrays become `_arr` containing `_ii` children with `data-_index` in meta. Numbers are distinguished from strings, including exponent and leading-dot forms.

* `parse_hson(input: string): HsonNode`
  paredHTML/HSON grammar to NEW nodes. Block closers decide cluster type: `>` for `_obj` and `/>` for `_elem`. Arrays accept `« … »` or `[...]` on input; re-serialize as guillemets.

All three parse wrappers run `assert_invariants(node)` before returning.

### Serialize

* `serialize_html(node: HsonNode): string`
  Emits XML-valid HTML. Optimizes simple primitives to single-line tags:

  * `<p "hello" />` for a single `_str` child
  * `<br />` for void elements
    Style can be an object or string; objects serialize to CSS text. Internal meta like `data-_quid` is omitted by default. Array indices are honored during HTML↔JSON transforms but are not emitted as user attributes.

* `serialize_json(node: HsonNode): string`
  Canonical JSON. `_obj` produces objects, `_elem` sequences produce arrays when appropriate. Primitives preserve type.

* `serialize_hson(node: HsonNode): string`
  paredHTML. Object blocks close with `>`, element blocks with `/>`, arrays as `« … »`. Single-primitive children render inline when safe.

---

## Invariants the parsers enforce

* `_root` wraps the document; it has 0 or 1 child which must be `_obj`, `_elem`, or `_arr`.
* `_obj` contains unique property tags (object semantics).
* `_elem` contains an ordered sequence (duplicate tags allowed).
* `_arr` contains only `_ii` children.
* `_ii` appears only directly under `_arr`, has exactly one child node, and carries a string `data-_index` in meta.
* `_str` has exactly one string payload.
* `_val` has exactly one non-string primitive payload (number, boolean, null).
* Value-wrapper VSNs (`_str`, `_val`) never have `_attrs`.
* Only meta keys prefixed with `data-_` are allowed in `_meta`.

`assert_invariants` is used at parse boundaries and before serialization during tests and internal pipelines.

---

## Fluent builder (convenience chain)

The builder is a thin wrapper over the direct functions. It’s eager: conversion happens at Stage 2, not at the end.

```ts
type FrameOptions = {
  spaced?: boolean;   // formatting (JSON/HSON)
  linted?: boolean;   // formatting passes
  withQuid?: boolean; // include data-_quid on serialize (default false)
};

type FrameConstructor = {
  input: string | Element;
  node: HsonNode;
  hson?: string;
  html?: string;
  json?: string;
  options?: FrameOptions;
};
```

### Stage 1: source

* `.fromHTML(html)` → parses with `parse_html`, builds a frame
* `.fromJSON(json)` → parses with `parse_json`
* `.fromHSON(hson)` → parses with `parse_hson`

Returns Stage 2 methods bound to the frame.

### Stage 2: output target

* `.toHTML()` → computes `frame.html = serialize_html(frame.node)`
* `.toJSON()` → computes `frame.json = serialize_json(frame.node)`
* `.toHSON()` → computes `frame.hson = serialize_hson(frame.node)`

Returns Stage 3 and Stage 4 methods.

### Stage 3: options

* `.spaced()` → sets `frame.options.spaced = true`
* `.linted()` → sets `frame.options.linted = true`
* `.withOptions(opts)` → shallow-merges options
* `.withQuid()` → sets `frame.options.withQuid = true` (include `data-_quid` when serializing)

Returns Stage 4 methods.

### Stage 4: render

* `.serialize()` → returns the precomputed string for the chosen target, applying formatting options if any
* `.parse()` → returns the parsed object for the chosen target when applicable

Example:

```ts
HSON.transform
  .fromHTML(html)
  .toJSON()
  .spaced()
  .serialize();
```

---

## Notes on meta emission

* `data-_index` lives in `_meta` during transforms and is used to reconstruct array order. It is not emitted as a user attribute by default.
* `data-_quid` is an internal identity used by the LiveTree layer. Parsers preserve it if present. Serializers omit it by default; opt in with `.withQuid()` or an explicit serializer option.

---

## Error handling

Parsers throw structured errors with source labels and short payload excerpts. The HTML preflight raises a clear error on unparseable XML after wrapping fragments in `_root`. JSON errors surface the native position message. The HSON parser reports unexpected tokens with a small surrounding context.

---

## What changed recently

* All public parse functions now return the NEW node shape directly.
* The strangler compat path was removed; no implicit conversion to the old node shape.
* `_arr/_ii` is the canonical array model across HTML, JSON, and HSON.
* HTML serializer inlines simple primitives to single-line tags and keeps voids self-closed.
* Internal meta emission is opt-in.
