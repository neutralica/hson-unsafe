Got it. Here’s your recap restyled into a clean status document — sectioned, headed, and with layered bullets for readability. I’ll keep it lean but add enough formatting so it’s easy to scan.

---

# HSON Refactor — State of Play

### **Initial Blockages**

* **Attrs vs Props**

  * `_attrs` were leaking into plain properties on standard tags.
  * **Fix**: `serialize-json` keeps attrs/content distinct → no siblings.
  * **Rationale**: Preserve clean JSON/HSON/HTML round-trips.

* **Flag Attributes (boolean HTML attrs)**

  * Observed JSON:

    ```json
    "_attrs": { "checked": "checked" }
    ```

    but later “nodified.”
  * **Fix**: Confined `_attrs` handling to attribute lanes only.
  * Prevented accidental tagification.

---

### **Array & Index Invariants**

* **Error**: `_array` children mis-tagged as invalid index tags.
* **Cause**: `data-_index` lost one direction; `_ii` created without meta.
* **Fix**: tokenizer/parser ensures every `_ii` gets `data-_index`.
* ✅ Array fixtures green, consistent both ways.

---

### **Invariant Checker**

* Misleading error: `_ii must appear under _arr` (parent passed `null`).
* **Change**: Root walk starts as `walk(root, "", root._tag, …)`; proper parent tags bubbled through recursion.
* **Decision**: Keep assertions **on** in public wrappers for safety.

---

### **Escaping & XML Strictness**

* Issues: quotes, `< >`, named entities, boolean attrs, void tags.

* **Preflight chain added** (for HTML input):

  * `strip_html_comments`
  * `expand_bools`
  * `escape_text_nodes`
  * `expand_entities`
  * `expand_void_tags`

* **Rationale**: Parse as XML (deterministic) while tolerating sloppy HTML.

* **Entity policy**

  * Core entities (`amp/lt/gt/quot/apos`) kept literal.
  * Others → numeric whitelist.
  * Unknowns → left as-is.

---

### **Coercion Rules**

* `coerce()` upgraded: safe number parsing.
* `_val` → must be non-string primitive.
* `_str` → always string.

---

### **Round-trip Consistency**

* Empty string `""` in arrays disappeared in HTML branch.
* Options explored: sentinel, `data-_empty`, relax `_ii`.
* **Decision**: Defer. Keep strict `_ii = exactly one child`.

---

### **Serialization Polish**

* Single-line primitive-only elements:

  * If one `_str` or `_val` child → emit `<tag "txt" />`.
* Indentation corrected at emit-time.

---

### **Style Handling**

* `style` attr: tolerate both **object ⇄ CSS string**.
* Helpers for **camel ↔ kebab** conversion.

---

### **Underscore Key Policy**

* For user JSON:

  * ❌ Disallow VSN-like keys (`_obj/_arr/_ii`).
  * ✅ Allow `_attrs` / `_meta` only if shallow-valid.
* **Rationale**: arrays/objects are syntactic in JSON; VSN reserved.

---

### **Refactor: NEW Node Shape**

* All parsers (json/html/hson) → `NEW` nodes.
* Public wrappers: `parse → assert_invariants_NEW → return NEW`.
* Old compat path removed from runtime.
* Exports cleaned (`index` → NEW types).

---

### **LiveTree Migration**

* `LiveTree_NEW`: selection = array of NEW nodes.
* Chainable API: `find`, `findAll`, `at`, `append`, `setAttr`, `setValue`, etc.
* DOM link map = `NODE_ELEMENT_MAP_NEW`.
* Query support: tag/attrs/meta matching, RegExp for meta.
* Added `.style` & `.dataset` managers.

---

### **Grafting Path**

* Constructors (`fromHTML/fromJSON/fromHSON`) return NEW nodes.
* `create_live_tree_NEW` → DOM without illegal meta attrs.

---

### **Testing**

* Core JSON/HTML/HSON 3-way tests: **green**.
* Intentional failures:

  * Invalid JSON controls.
  * User-injected VSN keys.
  * Empty-text array edge cases.

---

### **Build & TS Plumbing**

* Archived `src/old` outside `src` (no dist emission).
* Fixed exports (NEW API only).
* Deduped class declarations; cleared VSCode cache hiccups.

---

### **QUID (Stable Identity)**

* Introduced `_DATA_QUID`:

  * `ensure_quid`, `get_quid`, `find_by_quid`, `reindex_quid`.
  * Lazy assignment on handles (`find/findAll/at`).
* QUID kept **internal** (meta only).
* Serializer flag available to emit QUIDs for snapshots.
* **Removed leakage**: no DOM/HTML emission, no eager seeding.

---

### **Linter & Util Fixes**

* Handled `undefined _attrs`.
* Dropped “flags” concept → treat bool attrs consistently.

---

### **Logging & Debugging**

* Standardized error throws (no console-only).
* One-shot stack trap for accidental QUID emission (later removed).

---

### **Deferred / Future Work**

* Decide empty-string array representation.
* Canonicalize `make_string` pretty-printer.
* Expand LiveTree test matrix (arrays, grafting, style/dataset ops).
* Optional: move assertions inside implementations.

---

This makes a nice **checkpoint document** you could paste at the start of a new HSON session. Would you like me to compact it one step further into an “executive summary” version (like 10-12 bullets max) for when you just want a high-level restart?
