
#                                      ______                   
#    |         |             ..''''  .~      ~.  |..          | 
#    |_________|          .''       |          | |  ``..      | 
#    |         |       ..'          |          | |      ``..  | 
#    |         | ....''              `.______.'  |          ``| 
                                                           

#    1: HSON — Hypertext Structured Object Notation

> UNSAFE · EXPERIMENTAL
> pre-alpha demo for research and exploration
> not a finished product; do not use with sensitive or untrusted data

HSON is a markup format that unifies document (HTML) and data (JSON) by parsing both into a single in-memory tree of HsonNode objects and serializing back out. The same internal tree drives all conversions, so round-trips are explicit and predictable.

Alongside the transformers, the library includes a light, chainable LiveTree API for querying and mutating the HsonNode tree while keeping a live DOM in sync.

## Core concepts

#### 0. HSON and paredHTML

HSON’s human-authored syntax (“paredHTML”) is a compact, XML-valid tag language that can express both HTML-like elements and JSON-like structures. It is designed to serialize unambiguously back to HTML or JSON with no accidental changes in structure.

#### 1. HsonNode

Every parsed structure becomes a node with the same shape:

* _tag: the tag name, for example p, div, user, or a virtual structural tag like _obj or _arr
* _content: an array of child nodes or nothing
* _attrs: attributes for standard tags, for example { id: "x", disabled: "disabled" }
* *meta: reserved internal metadata; only keys that start with data-* are allowed

Value wrappers:

* _str wraps a string; its _content is exactly one string
* _val wraps a non-string primitive; its _content is exactly one boolean, number, or null

Virtual structural nodes (VSNs):

* _root    top-level wrapper the parsers use around a single document
* _obj     JSON object semantics (unordered, unique property names)
* _elem    HTML element semantics (ordered sequence; duplicate tags allowed)
* _arr     JSON array
* _ii      a single indexed array item under _arr

Rules and invariants:

* _ii appears only directly under _arr and contains exactly one child node
* _str has one string payload; _val has one non-string primitive payload
* VSNs never carry _attrs
* *meta keys must begin with data-*

#### 2. Arrays and stable ordering

Arrays are represented as _arr with child _ii nodes. Each _ii carries its index in meta as a string:

* _meta: { "data-_index": "0" }, "1", "2", …

This is required so round-trips through HTML (which has no inherent sibling indexing) can be lossless.

## HSON syntax

### Elements and attributes

paredHTML uses XML-style tags. Attributes and boolean flags appear after the tag name.

Example:

```
<user id="123" isAdmin "Pending Review" />
```

Node shape:

```
{
  _tag: "user",
  _attrs: { id: "123", isAdmin: "isAdmin" },
  _content: [ { _tag: "_str", _content: ["Pending Review"] } ],
  _meta: {}
}
```

Boolean attributes are serialized as the attribute name with an empty value in HTML terms, and preserved as name→name in _attrs.

### Content models

An element may contain a single primitive, a block of child elements, or an array.

1. Primitive content

Quoted strings must use double quotes and standard escapes. Unquoted primitives may be true, false, null, or a number (integers, decimals, or exponents like 1e-9).

Examples:

```
<message "Hello, world!\nNew line." />
<available true />
<score 1250 />
<lifespan null />
```

2. Block content (canonical wrappers)

Block content always uses an explicit VSN wrapper so its origin is preserved.

* Object block → _obj
  close with > in paredHTML

```
<user
  <name "John Doe">
  <email "john@example.com">
>
```

* Element block → _elem
  close with /> in paredHTML

```
<article
  <h2 "Title" />
  <p "Paragraph 1." />
  <p "Paragraph 2." />
/>
```

3. Array content

Arrays are written with guillemets « … » (square brackets are accepted and re-serialized as guillemets). Internally this becomes _arr containing _ii children.

```
<greek-letters
  «
    "alpha",
    "beta"
  »
>
```

Parses to:

```
{
  _tag: "greek-letters",
  _content: [
    {
      _tag: "_arr",
      _content: [
        { _tag: "_ii", _meta: { "data-_index": "0" }, _content: [ { _tag: "_str", _content: ["alpha"] } ] },
        { _tag: "_ii", _meta: { "data-_index": "1" }, _content: [ { _tag: "_str", _content: ["beta"] } ] }
      ]
    }
  ]
}
```

## Conversion rules

To keep round-trips precise, the parsers always wrap blocks with explicit VSNs.

* HTML parsing: children of any standard tag are wrapped in a single _elem node
* JSON parsing: properties of any object are wrapped in a single _obj node
* Arrays: _arr with _ii children; each _ii has exactly one child, plus data-_index

These wrappers are intentionally preserved even when serializing to the “other” format, so the structural origin is never ambiguous.

## HTML input normalization

HTML is parsed in XML mode to keep underscore tags and ensure consistent behavior across environments. Before parsing:

* strip_html_comments removes HTML comments, including illegal double-hyphen cases
* expand_bools normalizes boolean attributes into explicit form
* escape_text_nodes escapes raw text so <, >, &, " are XML-safe
* expand_entities leaves amp/lt/gt/quot/apos alone, converts a small named-entity whitelist to numeric references
* expand_void_tags normalizes self-closing tags

## Data attributes

Internal metadata lives in _meta and must use data-_prefixed keys, such as data-_index. User data attributes (for example data-user-id) live in _attrs and are serialized to the DOM as normal.

## LiveTree overview

The LiveTree API wraps arrays of HsonNodes and provides:

* find, findAll, at for selection
* setAttr, removeAttr, setContent, setValue for mutation
* style and dataset helpers for structured updates
* append, removeChild, empty for tree edits
* asDomElement and sourceNode for inspection

LiveTree keeps a Node↔HTMLElement map to synchronize DOM and data. A stable identity mechanism (data-_quid) exists but is assigned lazily by APIs that need it; it is not emitted to DOM or serialized by default.

---

### HSON.transform overview

The library exposes two complementary ways to convert between formats:

1. Direct functions
   parse_html, parse_json, parse_hson produce HsonNode trees.
   serialize_html, serialize_json, serialize_hson produce strings.
   Public parse wrappers run structural assertions before returning.

2. A small fluent builder for convenience
   A chain that guides you from input → output, with optional formatting.

#### The frame

Each transformation operates on a single frame:

```
interface Frame {
  input: string | Element            // original raw input
  node: HsonNode                     // parsed HSON tree
  hson?: string
  html?: string
  json?: string
  options?: FrameOptions             // for example { spaced: boolean, linted: boolean }
}
```

The frame is created once, then passed through the stages.

#### Four stages

Stage 1: Source

* Methods: fromHTML, fromJSON, fromHSON
* Action: parse input into a HsonNode tree and create the initial frame
* Notes: HTML is normalized to XML; JSON parsing is strict; HSON is parsed into the same NEW node shape

Stage 2: Output

* Methods: toHTML, toJSON, toHSON
* Action: serialize eagerly to the chosen output, storing the string on the frame

Stage 3: Options

* Methods: spaced, linted, withOptions
* Action: adjust frame.options for final formatting

Stage 4: Render

* Methods: serialize, parse
* Action: return the precomputed string (serialize) or a parsed object (parse), honoring any options

#### Example

```
HSON.transform
  .fromHTML(html)
  .toJSON()
  .serialize()
```

fromHTML parses to a HsonNode and creates the frame.
toJSON serializes eagerly and records the JSON string on the frame.
serialize returns that string, after applying any selected options.

#### Notes on behavior

* Parsers always wrap blocks with explicit VSNs (_obj, _elem, _arr/_ii) so origin is preserved
* _str and _val enforce their payload invariants at parse time
* *meta is reserved and accepts only data-* keys; VSNs never carry _attrs
* Attribute handling supports style as string or object; object styles are serialized to CSS text
* Builders are optional; you can call parse_\* and serialize_\* directly
* LiveTree is separate and operates on the same HsonNode trees to keep data and DOM entangled during UI work
