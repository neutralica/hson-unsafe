HSON
====

Installation
===

`npm install hson`


Usage
===

`npm install hson`

```
var HSON = require('hson');

obj = HSON.parse(hsonString);

```

To see a working example check [the hson example repo](https://github.com/dancalligaro/hson-example).


About
====

This is an easy way of wrting HTML in a JSON alike structure.

HSON covers a subset of JSON, this way HSON will be mapped entirely into a JSON object.

Wasn't XML's CDATA already taking care of this? Yes, but you would have to parse XML. Also XML elements have attributes which are not mapped directly into JSON.

Types of data supported
------
From the data types suppoted in the JSON definition, HSON currently only supports:
 - objects
 - arrays
 - strings

Support for number, date, boolean and undefined is not currently implemented.

Also, the top level object will be an object and cannot be an an array.

HSON syntax
====
Objects
------
What in JSON you would do: ` { "property": "value" }`

In HSON would become: ` <-property>value</-property> `.

Arrays
------
JSON 
```json
{ 
    "anArray": [ 
        { "property": "value" },
        { "property": "value" } 
    ]
}
```

HSON: 
```html
<-arr-anArray>
    <-item>
        <-property>value</-property>
    </-item>
    <-item>
        <-property>value</-property>
    </-item>
</-arr-anArray>
```


Example
=======

Input HSON string
---

```html
<-title><h1>This is the <span>Title</span></h1></-title>

<-aBlockOfHtml>

	<h1>Some Title</h1>
	<div>some content</div>

</-aBlockOfHtml>

<-anObject>
	<-aProperty>
		<-hereYouGo>So This is the content</-hereYouGo>
	</-aProperty>
	<-item>
		<div>a malformed html. not our problem
	</-item>
</-anObject>

<-arr-thisIsAnArray>

	<-item>
		<-prop1> something </-prop1>
		<-prop2> 
			<-x> something </-x>
			<-y> something </-y> 
		</-prop2>
		<-prop3> <a href="url">click here</a> </-prop3>
	</-item>

	<-item>
		<-prop1> hi there </-prop1>
		<-prop2> this is an example </-prop2>
		<-prop3> <a href="url">click here again</a> </-prop3>

		<-arr-prop5>
			<-item> item1 </-item>
			<-item> item2 </-item>
		</-arr-prop5>

	</-item>

</-arr-thisIsAnArray>
```

Output JSON 
---

```json
{
  "title": "<h1>This is the <span>Title</span></h1>",
  "aBlockOfHtml": "\n\n\t<h1>Some Title</h1>\n\t<div>some content</div>\n\n",
  "anObject": {
    "aProperty": {
      "hereYouGo": "So This is the content"
    },
    "item": "\n\t\t<div>a malformed html. not our problem\n\t"
  },
  "thisIsAnArray": [{
    "prop1": " something ",
    "prop2": {
      "x": " something ",
      "y": " something "
    },
    "prop3": " <a href=\"url\">click here</a> "
  }, {
    "prop1": " hi there ",
    "prop2": " this is an example ",
    "prop3": " <a href=\"url\">click here again</a> ",
    "prop5": [" item1 ", " item2 "]
  }]
}
``` 




