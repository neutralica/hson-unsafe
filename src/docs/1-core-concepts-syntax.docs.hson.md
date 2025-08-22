// core-syntax-data.docs.hson.ts

### HSON: Hypertext Structured Object Notation

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

tag: A string representing the element's name (p, div, name) or its VSN type (_obj, _elem, _str/_prim).
content: An array of child nodes, which can be other HsonNodes or Primitives.
_meta: An object containing attributes and flags ({attrs: HsonAttrs, flags: HsonFlags}).
2. VSNs (Virtual Structural Nodes)

VSNs are system-level HsonNodes whose tags begin with _. They don't represent semantic data (like "user" or "article") but rather provide explicit information about the structure of the content they hold. Using explicit VSN wrappers is the core principle for ensuring stability across all formats.

VSN	Origin	Represents
_obj	  JSON Object	An unordered map of unique key-value properties.
_elem	  HTMLElement	An unindexed sequence of child nodes.
_array	JSON Array	An indexed list of values.
_ii	    'indexed item'	A single indexed item within an _array.
_str    string 
_prim	  Primitive	A non-string 'basic' value ( number, boolean, null)

## HSON Syntax

# Elements & Attributes

HSON elements look similar to HTML/XML tags; the key difference is in the closing tag. Where HTML repeats the full tag to close it (`<section>...</secction>`), HSON's pHTML syntax uses the tag itself as the element delimiter (`<section "..." />`). This allows for much more compact HTML in a smaller file size. 

As in HTML, attributes and boolean flags are defined after the tag name.

Syntax: <tagName attr1="value" attr2="value" flag1 flag2>
Example:
Code snippet

<user id="123" isAdmin "Pending Review">

tag: "user"
_meta.attrs: { "id": "123" }
_meta.flags: ["isAdmin"]
Content: A _str/_prim node with value "Pending Review"
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
* contents of _elem can have duplicate tags 
Code snippet
`
<article
  <h2 "Title" />
  <p "Paragraph 1." />
  <p "Paragraph 2." />
/>
`
 
 
 # 3. Array Content («...»)
A JSON-style array is represented by guillemets. It maps to an _array VSN.

Code snippet
<tags 
  « 
    "alpha", 
    "beta", 
    "gamma" 
  »
>

(HSON's HSON parser also accepts brackets for array delimiters, but will re-serialize as guillemets.)


# Conversion Rules: The "Always Wrap" Principle

To ensure stability, parsers are unambiguous. "Clusters" of nodes in HSON - representing an element's child nodes, a more complex object value in JSON, or the contents of an array - must be differentiated during parsing to maintain data integrity.

# Rule 1: html_to_node (HTML Parser)
When parsing HTML, the children of any standard tag (like <p>, <div>, <li>) are wrapped in a single _elem VSN.

HTML Input: <p>Hello</p>
Correct HsonNode Output: {tag:"p", content:[ {tag:"_elem", content:[{tag:"_str", content:["Hello"]}]} ]}
Rule 2: json_to_node (JSON Parser)
When parsing a generic JSON object, its properties are considered a key-value map. Therefore, its properties are always wrapped in a single _obj VSN.

JSON Input: {"p": "Hello"}
Correct HsonNode Output: {tag:"_obj", content:[ {tag:"p", content:[{tag:"_prim", content:[1000]}]} ]} (This is then wrapped in a _root by the main function).
This difference is correct and intended. It explicitly captures the semantic origin of the structure. A JSON -> HTML conversion is a defined transformation from an _obj model to a _elem model. The system stabilizes on the _elem model after passing through HTML.

# `data-index` Attributes for Data Integrity

When serializing a JSON array (an _array HsonNode) to HTML, the index sequence must be preserved. Since HTML has no inherent order for sibling elements with the same tag, the parser  adds a data-index="0", data-index="1", etc., attribute to the <_ii> tags. The html_to_node parser uses this attribute to reconstruct the _array in the correct order.