// constants.tests.hson.ts


const sample_HTML = {
    basic: `<p>a simple paragraph</p>`,
    basicNewline: `<article>
    a paragraph with a newline
</article>`,
    withAttribute: `<user data-id="123">test user</user>`,
    withMultipleAttributes: `<img src="/logo.png" alt="company logo" class="main-logo">`,
    withFlag: `<input type="text" disabled>`,
    nested: `<div><p>a nested paragraph</p></div>`,
    deeplyNested: `<main><section>
    <article>
        <h1>article title</h1>
    </article>
</section></main>`,
    siblings: `<h2>title</h2><p>first paragraph</p><p>second paragraph</p>`,
    // selfClosing: `a line of text<hr/>another line`,
    comment: `<!-- this is a comment --><p>content</p>`,
    mixedContent: `<div>this is a <span>mixed content</span> node</div>`,
};

const sample_JSON = {
    simpleObject: `{"username": "alex", "score": 100}`,
    nestedObject: `{"user": {"id": 456, "status": "active"}}`,
    simpleArray: `["alpha", "beta", "gamma"]`,
    arrayOfObjects: `[{"item": "one"}, {"item": "two"}]`,
    mixedTypes: `{
        "id": 99,
        "name": "test data",
        "isComplete": true,
        "value": null,
        "tags": ["a", "b"],
        "meta": {"version": 1.1}
    }`,
    emptyObject: `{}`,
    emptyArray: `[]`,
    stringWithEscapes: `{"message": "hello\\nworld, this is a \\"quote\\""}`,
};