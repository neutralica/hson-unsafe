#    ▌         ▜ ▘    ▄▖      
#    ▛▌▛▘▛▌▛▌  ▐ ▌▌▌█▌▐ ▛▘█▌█▌
#    ▌▌▄▌▙▌▌▌▗ ▐▖▌▚▘▙▖▐ ▌ ▙▖▙▖
                         
# HSON liveTree

liveTree is HSON’s runtime layer for reading and mutating a document through the canonical HsonNode tree while keeping the real DOM in sync. It’s built on the NEW node shape and the node↔element map, so changes you make to nodes reflect in the browser immediately.

---

## What lives where

* Parsers/serializers: turn HTML/JSON/HSON ↔ HsonNode.
* liveTree: wraps one or more HsonNode and gives you a chainable API to find, read, and mutate.
* create_live_tree: builds DOM from nodes and populates a `WeakMap<HsonNode, HTMLElement>`.
* Quid utilities (optional): stable ids for nodes you want to re-find later (`data-_quid` in meta; not emitted by default).

---

## Getting a tree

Two entry points:

### 1) Graft onto the live DOM

```ts
// Replace the body’s contents with an HSON-controlled version
const tree = hson.liveTree.queryBody().graft(); // LiveTree

// Or target a specific element
const app = hson.liveTree.queryDom('#app').graft();
```

`graft()`:

* reads `element.innerHTML`
* parses to NEW nodes (HTML preflight: strips comments, expands booleans, escapes unsafe text, normalizes entities, expands voids)
* rebuilds DOM via `create_live_tree` (populates the node→element WeakMap)
* replaces the original element with the controlled DOM
* returns a `LiveTree` at the new root

### 2) Build a detached branch (not attached to the DOM yet)

```ts
// From HTML
const branch = hson.UNSAFE.liveTree.fromHTML('<div><h2>Hi</h2></div>').asBranch();

// From JSON
const branch2 = hson.UNSAFE.liveTree.fromJSON('{"div": {"_elem": [{"h2": "Hi"}]}}').asBranch();

// From HSON
const branch3 = hson.UNSAFE.liveTree.fromHSON('<div <h2 "Hi" /> />').asBranch();

// Attach the branch into some selected node later:
app.find('#container').append(branch);
```

`from*().asBranch()` parses and builds a live, detached subtree (nodes + DOM + map) but does not insert it. Use `.append(...)` on some selection to place it.

`UNSAFE` lets you skip sanitizer when ingesting HTML; the XML preflight still runs.

---

## Querying

A `LiveTree` wraps the current selection (one or more nodes). Methods return a new wrapper unless noted.

```ts
// CSS-ish string or object query
const firstP = tree.find('p');                 // first match under selection
const allItems = tree.findAll({ tag: 'li' });  // all matches under selection
const third = allItems.at(2);                  // narrow selection to index
```

Query object shape:

```ts
type HsonQuery = {
  tag?: string;
  attrs?: Partial<HsonAttrs>;
  meta?: Record<string, string | number | boolean | RegExp>;
  text?: string | RegExp; // optional; if provided, matches descendant text
};
```

Implemented matching today:

* tag (case-insensitive)
* attrs (exact equality per key)
* meta (exact equality or regex test; intended for `data-_...` keys)

---

## Reading

```ts
// Attributes (first node in selection)
const href = tree.find('a').getAttr('href');   // string | undefined

// First text under the node (DOM textContent)
const title = tree.find('h1').getFirstText();  // string

// Form values (matches DOM property semantics)
const v = tree.find('#name').getValue();       // string

// Count of nodes in selection
const n = tree.findAll('li').count();          // number

// Underlying node(s) (debugging)
const raw = tree.find('#panel').sourceNode();      // HsonNode[]
const one = tree.find('#panel').sourceNode(false); // first HsonNode
```

---

## Mutating

All mutators act on every node in the current selection and return `this` for chaining. DOM and nodes stay in sync via the map.

```ts
// Replace inner content with plain text
tree.find('#header').setContent('Welcome');

// Set/remove attributes and booleans
tree.find('a').setAttr('href', '/about');
tree.find('input').setAttr('disabled', true);   // empty attribute in DOM, no value stored in _attrs
tree.find('input').removeAttr('disabled');

// Append HTML/JSON/HSON or another LiveTree branch
tree.find('#list').append('<li class="new">New</li>');
tree.find('#list').append(branch);             // attach a detached branch

// Set form control values
tree.find('textarea').setValue('hello');

// Remove nodes (DOM + map + selection)
tree.findAll('.toast').remove();
```

Notes:

* `_attrs` is created lazily if missing.
* `_str` and `_val` VSNs are treated as leaf text. Setting content replaces children accordingly.
* For style and dataset, use the helpers described next.

---

## Style and dataset helpers

Lazy managers on the current selection. They operate on elements via the map.

```ts
// Style
tree.find('#box').style.set('backgroundColor', '#222');
tree.find('#box').style.get('backgroundColor'); // "#222"
tree.find('#box').style.remove('backgroundColor');

// Dataset (data-*)
tree.find('#box').dataset.set('userId', '42');   // sets data-user-id in DOM and _attrs
tree.find('#box').dataset.get('userId');         // "42"
tree.find('#box').dataset.remove('userId');
```

Internal `data-_...` keys are reserved for HSON (array indices, quids). Dataset manager targets user-facing `data-*` keys, not `data-_...`.

---

## Identity and data-_quid (optional)

By default, serializers omit `data-_quid`. liveTree selections hold direct references to node objects and use a `WeakMap` to find DOM elements, so you usually don’t need ids.

Use quids if you plan to store a pointer externally and re-find the node after structural changes or subtree replacement:

```ts
import { ensureQuid, getNodeByQuid, seed_quids } from 'hson/quid';

// Give a node an id (writes to node._meta['data-_quid'] and indexes it)
const q = ensureQuid(tree.find('#save-button').sourceNode(false) as HsonNode);

// Later…
const node = getNodeByQuid(q);
```

`seed_quids(root, { includeVSNs?: false })` walks a tree and ensures quids on all standard tags (optionally VSNs). Use this before operations that replace node objects so you can reindex quickly.

Serializers only emit `data-_quid` when you opt-in (e.g., a `.withQuid()` option on the builder).

---

## DOM access

```ts
tree.find('#button').asDomElement(); // HTMLElement | null
```

This returns the real element for the first node in the selection, via the node→element map.

---

## Implementation notes (NEW shape)

* Attributes live on `node._attrs` (object). Boolean attributes are represented as present-with-empty-string in DOM; in `_attrs` they are omitted rather than stored as `"disabled": "disabled"`.
* VSNs `_str` and `_val` never have `_attrs`.
* Cluster VSNs:

  * `_elem` wraps children of a standard tag parsed from HTML
  * `_obj` wraps properties when parsing JSON objects (unique child tags)
  * `_arr` contains `_ii` children; each `_ii` has one child and `data-_index` in meta
* Only `data-_...` keys are legal in `_meta`. User `data-*` attributes belong in `_attrs`.

---

## Typical flows

Ingest live DOM and tweak:

```ts
const tree = hson.liveTree.queryBody().graft();
tree.find('header h1').setContent('Updated');
tree.find('a.next').setAttr('href', '/page/2');
```

Build, then attach:

```ts
const branch = hson.UNSAFE.liveTree
  .fromHSON('<card <h3 "Title" /> <p "Body" /> />')
  .asBranch();

tree.find('#cards').append(branch);
```

Store a durable handle to a node you’ll revisit:

```ts
const q = ensureQuid(tree.find('#save').sourceNode(false) as HsonNode);
// …later after some rebuild
const n = getNodeByQuid(q);
if (n) new LiveTree(n).setAttr('data-status', 'done');
```

---

## Error handling

* All input paths validate NEW invariants early. If a graft fails, you’ll get a structured parse error pointing at the source stage (HTML preflight, JSON parse, HSON tokenize/parse).
* Mutators are defensive: they skip incompatible tags (e.g., `setValue` warns on non-input/textarea) and keep going on the rest of the selection.
* When a query fails, you get an empty selection; chaining mutators on an empty selection is a no-op.

---

## Performance

* Node→element mapping uses a `WeakMap` to avoid leaks.
* Query traversals are depth-first over the current selection’s subtrees.
* Attribute and text updates touch both the node and the live element in O(1).
* If you plan to replace large subtrees, use quids and `reindex` helpers to keep external handles resolvable without expensive global searches.

This doc reflects the current NEW-only implementation: old shapes are removed, flags are gone, attributes live on `_attrs`, internal meta uses `data-_...`, and quids are opt-in.
