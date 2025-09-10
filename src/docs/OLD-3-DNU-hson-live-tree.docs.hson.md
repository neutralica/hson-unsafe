// hson-live-tree.docs.hson.md

## HSON's liveTree interface 

# Overview

HSON's data transformation capabilities enable a stateful, interactive interface for manipulating the live browser DOM in real time. 

This system is composed of two main layers: a low-level Proxy Engine that reads and writes data, and a high-level Query Builder (HsonTree) that provides a robust and ergonomic API for developers.

liveTree is called via hson.liveTree(el: HTMLElement). If no argument is passed to liveTree, it will target document.body.

##  1: Core Engine (  create_proxy()  )

The HSON liveTree is an implementation of the Proxy pattern.  create_proxy() ultimately returns an object, { proxy, sourceNode }, which cleanly separates the interactive tool from its underlying data source.


  # the get Handler (The "Read" Operation)

The get handler intercepts requests to properties like tree.body.class and follows a simple process:

-> check special methods: it first checks for built-in utility methods like .sourceNode() to get the raw HsonNode, or .asTree() to get the clean, VSN-shorn TypeScript object

-> check attributes: if the property name is not a special method, it checks the targetNode._meta.attrs object. If a matching key is found, it returns the value.

-> check 'flags': if the get handler finds an attribute whose key and value are the same (e.g., { disabled: "disabled" } or <tag disabled="disabled"> in XML), it correctly returns the boolean true, providing an intuitive TypeScript-like experience.

-> check child nodes & unwrap: if the property is not an attribute, it searches for a child node with a matching tag. If the found child is "self-closing" (contains no attributes and only a single content node), the handler unwraps it and returns the raw primitive value (e.g., the string "Invertebrate Explorer" instead of another proxy). This is accomplished via the isSimpleUnwrappable and getPrimitiveContent helpers.

-> If the child is complex, it creates and returns a new proxy for that child, allowing for method chaining (tree.body.header...).

# The set Handler (The "Write" and "Sync" Operation)

The set handler intercepts assignments like `tree.body.class = 'dark-theme'`. It is type-aware:

-> If the value is a Primitive (string, number, boolean):

It first checks if a child node exists with that property name. If so, it updates that child's content.

// TODO -- separate these
// (TODO -- also this might be slightly misconfigured)
If not, it assumes you mean to set an attribute on the current node. It correctly handles setting string values versus adding/removing boolean flags.

-> If the value is an object:

This triggers the node creation/replacement features.

It uses JSON.stringify() on the object and feeds it to parse_json(). This correctly parses the simple object back into a valid, VSN-rich HsonNode tree.

It then uses splice() to swap this new node into the parent's content array.

## Part 2: The Live DOM Connection (The HSON.liveTree() Method)

The "live" DOM link is enabled via a central, shared `nodeElementMap = new WeakMap()`. This map creates an external, memory-safe link from each HsonNode to its live HTMLElement.

The liveTree() Workflow: HSON.liveTree(element) method encapsulates the entire live-sync process into a single, elegant command:

- copies the target element's innerHTML
- uses parse_html to create the HSON model
- calls a create_live_tree utility, which recursively builds the new DOM elements and, populates the nodeElementMap
- replaces the original element on the page with this new, HSON-controlled version
- calls create_proxy and returns the final, interactive object

liveTree() defaults to ingesting and cloning document.body if no DOM HTMLElement is provided.

## Part 3: Using liveTree()

```TypeScript 
import { hson } from 'hson';

// Create a live tree by grafting onto a DOM element
const tree = hson.liveTree(document.getElementById('app'));
```

# Finding Nodes

These methods allow you to query the tree and change the current selection of nodes.


.find()

```TypeScript 
.find(query)
```

Searches the descendants of the current selection and returns a new HsonTree instance containing the first node that matches the query.

```TypeScript 
// Find the first <p> tag
const firstParagraph = tree.find('p');

// Find the first node with the attribute id="main"
const mainContent = tree.find({ attrs: { id: 'main' } });
```


.findAll()

```TypeScript 
.findAll(query)
```

Searches the descendants of the current selection and returns a new HsonTree instance containing all nodes that match the query.

```TypeScript 
// Find all list items with the class 'active'
const allActiveItems = tree.findAll({ tag: 'li', attrs: { class: 'active' } });
```


.at(index)

Reduces a selection of multiple nodes down to a single node at a specific index.

```TypeScript 
// Get the third 'li' element from the previous selection
const thirdActiveItem = allActiveItems.at(2);
```

# Modifying Nodes

These methods mutate the nodes in the current selection and return the same HsonTree instance for chaining.


.setContent(content)

Replaces the entire inner content of all selected nodes with a new text value.

```TypeScript 
tree.find('#header').setContent('Welcome to HSON');
```


.setAttr(name, value)

Sets an attribute or a boolean flag on all selected nodes.

```TypeScript 
// Set a standard attribute
tree.find('a').setAttr('href', '/about');

// Set a boolean flag
tree.find('input').setAttr('disabled', true);

// Remove an attribute
tree.find('input').setAttr('disabled', null);
```


.removeAttr(name)

A convenience method for removing an attribute or flag. Equivalent to .setAttr(name, null).

```TypeScript 
tree.find('input').removeAttr('disabled');
```


.append(content)

Parses the given content and appends it as a new child to all selected nodes.

```TypeScript 
// Append a new paragraph with a string
tree.find('#main-content').append('<p>This is a new paragraph.</p>');

// Append a new node from a primitive value
tree.find('#user-age').append(42);
```


# Reading Data & Values

These methods extract information from the current selection. They typically operate on the first node if the selection contains multiple nodes.


.getAttr(name)

Gets the value of an attribute or flag from the first node in the selection.

```TypeScript 
// Returns the string 'submit'
const buttonType = tree.find('button').getAttr('type');

// Returns `true` if the button has the 'disabled' flag
const isDisabled = tree.find('button').getAttr('disabled');
```


.getFirstText()

Gets the text content of the first node in the selection.

```TypeScript 
const pageTitle = tree.find('h1').getFirstText();
```


.getValue()

Gets the value from a form element (<input>, <textarea>, etc.). Consistent with the browser DOM, this always returns a string.

```TypeScript 
const username = tree.find('#username-input').getValue();
```

.count()

Returns the number of nodes in the current selection.

```TypeScript 
const numItems = tree.findAll('li').count(); // Returns 3
```


.sourceNode()

Returns the raw, underlying HsonNode for the first item in the selection, with all VSNs intact; usually used for debugging.

