// readme.hson.md

▗▖ ▗▖ ▗▄▄▖ ▗▄▖ ▗▖  ▗▖
▐▌ ▐▌▐▌   ▐▌ ▐▌▐▛▚▖▐▌
▐▛▀▜▌ ▝▀▚▖▐▌ ▐▌▐▌ ▝▜▌                             pre-alpha demo
▐▌ ▐▌▗▄▄▞▘▝▚▄▞▘▐▌  ▐▌       Hypertext Structured Object Notation
----------------------------------------------------------------

> [!WARNING]
> **UNSAFE - EXPERIMENTAL**
>
> Use for research or educational purposes. Do not use with important or sensitive business data. Do not use with unknown third-party data or html.

HSON is a glue format that unifies JSON and HTML in a minimalist, pared-down syntax of HTML.

It fully represents both data and markup under a single unified format (in a more compact file size than either). By connecting JSON and HTML's consistent, tree-based data structures, HSON can fluently and losslessly translate data from one to the other and back. 

This library also provides a stateful API for grafting onto and manipulating live DOM elements, enabling reactive UIs built on a clear, declarative data model that manipulates the DOM itself via traditional JS Object methods and dot-notation access.

The core HSON is a set of seven transformers that convert data between HTML, JSON, and HSON's own minimalist syntax (paredHTML). A small, compact API (hson.transform, hson.liveTree to start*) and simple toolchain are all that is needed to begin manipulating complex on-screen DOM elements with the precision of native JavaScript objects. 

> This project is a proof of concept and not a final version. Carries a risk of executing unescaped html from unknown sources.  Use at your own risk. 

### Installation
// NOT LIVE ON NPM
// ```bash 
// npm install hson
// THIS DOESNT EXIST


Quick Start

Use the hson.transform fluent API to convert between formats.

```JavaScript
import { hson } from 'hson';

// 1. Start with an HTML string
const html = '<div id="main"><p class="greeting">Hello</p></div>';

// 2. Convert it to its HSON representation
const hsonString = hson.transform
  .fromHTML(html)
  .toHSON()
  .serialize();


console.log(hsonString);
/*
<div id="main"
  <p class="greeting" "Hello" />
/>
*/

// 3. Continue the chain to get a clean JSON object
const jsonObject = hson.transform
  .fromHTML(html)
  .toJSON()
  .parse();

console.log(jsonObject);
/*
{
  "div": {
    "_meta": { "attrs": { "id": "main" } },
    "p": {
      "_meta": { "attrs": { "class": "greeting" } },
      "#text": "Hello"
    }
  }
}
*/
```
Documentation

For HSON's syntax, API, and core concepts, please see the /docs directory.