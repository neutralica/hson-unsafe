# 'flags' Semantics in HSON

In HSON, HTML _meta data (`_meta.attrs, _meta.flags`) supports two kinds of properties:

- flags (conceived as an array of strings)
- attrs (matches HTML attributes, key="value")

A flag is defined when a key's value exactly matches its key (`key === value`).
This affects how the attribute is serialized into HTML.

Examples:

- Flag:
    - Internal HSON: `"disabled": "disabled"`
    - (XML sees: disabled = "disabled")
    - Serialized HTML: `<input disabled>`
- Key–Value Pair:
    - Internal HSON: `"type": "text"`
    - Serialized HTML: `<input type="text">`

Rules:

- When serializing to HTML:
    - If `key === value`, serialize as a flag (only the key is printed, no `=`).
    - Otherwise, serialize as `key="value"`.
- When parsing from HTML:
    - A flag (e.g., `<input disabled>`) is parsed into an attribute where the key and value match.
- When serializing to JSON:
    - No distinction is made; all flags and attributes are key–value pairs.
- Flags must not have distinct values:
    - `"disabled": "true"` is NOT a flag (it will serialize as `disabled="true"`).

Advantages:

- Enables faithful round-trip between JSON and HTML.
- Preserves the semantic difference between flags and key–value pairs.
- Supports both human-writable and machine-readable formats.
- Allows future extensions without breaking attribute assumptions.

Summary:

Flags are inferred based on `key === value` at serialization time.
Storage in HSON always treats them as normal key–value pairs.
