// core-syntax-data.docs.hson.ts

### 1: HSON: Hypertext Structured Object Notation

> !UNSAFE !EXPERIMENTAL
> pre-alpha demo: for research, education, and exploration only
> this is a proof of concept and not a finished product
> do not use with sensitive or important data
> do not use with unknown or untrusted third-party data


HSON is a markup format that unifies data (JSON) and document (HTML), using an internal 'HsonNode' tree as the intermediary structure underlying both.

The core of the HSON library (HSON.transform) is a set of 7 transformers that convert JSON, HTML, and HSON itself to and from the internal HSON Node structure common to all three.

This pre-alpha demo of HSON also includes a simple yet powerful API (.liveTree) that allows for the manipulation of this data in ways that make traditional DOM query and manipulation methods largely unnecessary. Though lightweight, the pre-alpha API allows for complex manipulation and automatic updating of the DOM via standard JS Object methods and dot notation access. 

## Core Concepts

# 0. HSON & paredHTML

HSON is the universal format that unifies both JSON and HTML, written in a concise, minimalist syntax of HHTML called paredHTML (see below for syntax and rules). By drawing a direct analogy between JSON's key:value pairs and HTML's parent/child nodes, HSON can represent either and, crucially, transform one to the other and back with no data loss or noise.

While HSON.transform is able to serialize HTML into JSON and vice versa, the HSON syntax natively and most concisely expresses both/either in a human-readable format, a crucial conceptual step in the creation of this library.


# 1. HSON Nodes

The HsonNode type is the universal, in-memory structure common to all three formats. JSON and HTML both are parsed into this structure, and every serializer uses this structure to generate its output string. It has three key properties:

_tag: A string representing the element's name (p, div, name) or its VSN type (_obj, _elem, _str/_prim).
_content: An array of child nodes, which can be other HsonNodes or Primitives.
_meta: An object containing attributes and flags ({attrs: HsonAttrs, flags: HsonFlags}).


2. "cluster" VSNs (Virtual Structural Nodes)

Cluster VSNs are system-level HsonNodes whose tags begin with _. They don't represent user data (like "name" or "article") but rather provide explicit parser information about the structure of the content they hold. Using explicit VSN wrappers is the core principle for ensuring stability across all formats.

VSN	Origin	Represents
_obj	  JSON Object	An unordered map of unique key-value properties.
_elem	  HTMLElement	An unindexed sequence of child nodes.
_arr	  JSON Array	An indexed list of values -- newly promoted to its own VSN cluster as of the most recent refactor (see update 6)
_ii	    'indexed item'	A single indexed item within an _array.
_str    string 
_val	  'BasicValue'	A non-string 'basic' value ( number, boolean, null)

## HSON Syntax

# Elements & Attributes

HSON elements look similar to HTML/XML tags; the key difference is in the closing tag. Where HTML repeats the full tag to close it (`<section>...</secction>`), HSON's pHTML syntax uses the tag itself as the element delimiter (`<section "..." />`). This allows for much more compact HTML in a smaller file size. 

As in HTML, attributes and boolean flags are defined after the tag name.

Syntax: <tagName attr1="value" attr2="value" flag1 flag2>
Example:
Code snippet

<user id="123" isAdmin "Pending Review">

( OLD NODE STRUCTURE - OBSOLETE:
_tag: "user"
_meta.attrs: { "id": "123" }
_meta.flags: ["isAdmin"]
_content: /* a _str node with _content = "Pending Review" */
)

NEW NODE STRUCTURE - our refactor is moving all nodes to this shape:
_tag: "user"
_attrs: { "id": "123", isAdmin: "isAdmin" }
_content: /* same: a _str node with _content = "Pending Review" */
_meta: {}

Content Models

An HSON element's content can be a primitive value, a block of other elements, or a JSON-style array.

# 1. Primitive Content
A single primitive value can follow the attributes/flags.

Quoted Strings: Must be enclosed in double quotes. \n, \t, \", \\ are escaped. <message "Hello, world! \nNew line.">
Unquoted Primitives: Keywords true, false, null, and any valid number are written without quotes. <item available true> <score 1250> <lifespan null>


# 2. Block Content (The Canonical Wrappers)
 Nested elements open with < followed by the unquoted tag name 
 The type of closer determines the structure and signals the data's origin: `>` for JSON-style objects and `/>` for HTML-style elements.

# (_obj) Object Block (> closer): a wrapper for a key-value map
* Children must have unique tags *
Code snippet`
<user
  <name "John Doe">
  <email "john@example.com">
> 
`

# (_elem) Element Block (/> closer): a wrapper for child nodes 
* contents of _elem can have duplicate tags so it is essential to keep them distinct from _obj clusters to avoid errors when roundtripping

Code snippet
`
<article
  <h2 "Title" />
  <p "Paragraph 1." />
  <p "Paragraph 2." />
/>
`
the '/>' closer indicates _elem (html source) in HSON serialization 
 
 # 3. Array Content («...»)
A JSON-style array is represented by guillemets - brackets are also accepted but serialized as guillemets. It maps to an _arr cluster VSN.

Code snippet
<greek-letters 
  « 
    "alpha", 
    "beta"
  »
>
parses to:
{ 
  _tag: "greek-letters",
  _content:[
    {
     _tag: "_arr",
     _content: [
      {
       _tag: "_ii",
       _content: [
        {
         _tag: "string",
         _content: ["alpha"],
         _meta: {
          data-_index: 0,
         }
        }
      ]
      },
      {
       _tag: "_ii",
       _content: [
        {
         _tag: "string",
         _content: ["beta"],
         _meta: {
          data-_index: 1,
         }
        }
      ]
      },

    ]
   }
]}

(HSON's HSON parser also accepts brackets for array delimiters, but will re-serialize as guillemets.)


# Conversion Rules: The "Always Wrap" Principle

To ensure stability, parsers are unambiguous. "Clusters" of nodes in HSON - representing an element's child nodes, a more complex object value in JSON, or the contents of an array - must be differentiated during parsing to maintain data integrity.

# Rule 1: parse_html (HTML Parser)
When parsing HTML, the children of any standard tag (like <p>, <div>, <li>) are wrapped in a single _elem VSN.

HTML Input: <p>Hello</p>
Correct HsonNode Output: {tag:"p", content:[ {tag:"_elem", content:[{tag:"_str", content:["Hello"]}]} ]}

# Rule 2: parse_json (JSON Parser)
When parsing a generic JSON object, its properties are considered a key-value map. Therefore, its properties are always wrapped in a single _obj VSN.

JSON Input: {"p": "Hello"}
Correct HsonNode Output: {tag:"p", content:[ {tag:"_obj", content:[ {tag:"_str", content:["Hello"]}]} ]} (This is then wrapped in _root  (<_root<p "Hello">) by the main function -- the _root is usually stripped before it is returned)).
This difference is correct and intended. It explicitly captures the semantic origin of the structure. A JSON -> HTML conversion is a defined transformation that preserves the _obj structure as it passes through HTML and back out, and _elem vice versa.

# `data-_index` Attributes for Data Integrity

When serializing a JSON array (an _array HsonNode) to HTML, the index sequence must be preserved. Since HTML has no inherent order for sibling elements with the same tag, the parser  adds a data-_index="0", data-_index="1", etc.,  to the <_ii> tags' '_meta' property. The html_to_node parser uses this property to reconstruct the _array in the correct order; the _ii nodes disappear when serialized back into native JSON, as does the _meta data. any 'data-_' property belongs in _meta; currently we only use data-_index and data-_quid. any other 'data-' property (no underscore) is user data and should be rendered as an attribute.