// hson-live-tree.docs.hson.md

### HSON's liveTree interface ### 

# Overview

    HSON's liveTree API provides a stateful, interactive interface for manipulating the live 
    browser DOM in real time. It allows developers to create and manage components, treating 
    the DOM exactly like a JS Object.

The entry point is the hson.liveTree API, a chainable, set of methods for creating LiveTree instances. liveTree is a controller object that clones and then replaces parts of the DOM or the entire document.body, allowing for complex queries and manipulations directly on the markup itself. 

Part 1: Creating a LiveTree

two ways to create a LiveTree:
    - graft(): parsing and replacing an existing element in the DOM
    - branch(): creating a new, detached component from a data source.

 .graft(): 'ingest' DOM elements and replace them with a live-updating clone

 makes an existing plain HTML element interactive. query the DOM for a target via queryDom or use queryBody() to target document.body and then "graft" the LiveTree onto it. The element and its child nodes will be fully parsed and replaced with a clone created from the Node representation of the original HTML.

 usage:

TypeScript
// THIS DOES NOT EXIST YET
// import { hson } from 'hson';

// target #app and replace its content with a live tree.
// By default, this is SAFE and will sanitize the element's HTML.

const appTree = hson.liveTree.queryDOM('#hson-app-container').graft();

// For developer-authored content that you trust completely (e.g., your main app shell),
// use the UNSAFE namespace to prevent the sanitizer from stripping necessary tags like <script>.
const trustedAppTree = hson.UNSAFE.liveTree.queryDOM('#app').graft();
Path 2: Creating a Detached Component (.asBranch())

This method allows you to create a component from a data source (like an HTML or JSON string) without immediately attaching it to the page. This creates a detached "branch" that can be appended to another LiveTree.

TypeScript
const htmlString = `<p class="welcome">hello world</p>`;

// Create a new, unattached LiveTree instance from the HTML string.
// This is the primary way to create reusable components.
const newBranch = hson.liveTree.fromHTML(htmlString).asBranch();
Part 2: Component Composition

Once you have a main LiveTree, you can dynamically add to it by appending detached branches. The .append() method is smart enough to accept another LiveTree instance, which allows you to compose complex UIs from smaller pieces.

TypeScript
// Assume 'appTree' is an existing LiveTree instance.
// Assume 'newBranch' is a detached branch we created.

// Append the new component to the main application tree.
// HSON handles grafting the nodes, DOM elements, and internal maps.
appTree.append(newBranch);
Part 3: LiveTree Method Reference

Once you have a LiveTree instance, you can use the following methods to query and manipulate it.

Finding Nodes

These methods allow you to query the tree and return a new LiveTree instance scoped to the selection.

.find(query): Searches descendants and returns a new LiveTree containing the first node that matches the query.

.findAll(query): Searches descendants and returns a new LiveTree containing all nodes that match the query.

.at(index): Reduces a selection of multiple nodes down to the single node at a specific index.

Modifying Nodes

These methods mutate the nodes in the current selection.

.setContent(content): Replaces the inner content of all selected nodes with a new text value (this is safe and performs escaping).

.setAttr(name, value): Sets an attribute or a boolean flag on all selected nodes.

.removeAttr(name): Removes an attribute or flag.

.append(content): Appends new content to all selected nodes. The content can be an HTML string, a primitive, or another LiveTree instance.

Reading Data & Accessing the DOM

These methods extract information from the current selection.

.getAttr(name): Gets the value of an attribute or flag.

.getFirstText(): Gets the text content of the first node in the selection.

.getValue(): Gets the value from a form element (<input>, etc.).

.count(): Returns the number of nodes in the current selection.

.domElement(): (New) Returns the underlying, raw HTMLElement for the first selected node. This is the "escape hatch" used for attaching event listeners or using other native browser APIs.

TypeScript
// Use .domElement() to get the button to attach a click listener.
const buttonEl = appTree.find('button').domElement();
if (buttonEl) {
  buttonEl.addEventListener('click', () => console.log('clicked!'));
}