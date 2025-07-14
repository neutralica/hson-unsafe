// hson.transform.docs.hson.md

# HSON.transform Overview

The hson.transform toolchain is designed as a stateful fluent interface, also known as a "builder pattern." It exposes the core parsers and serializers that convert HTML to JSON and back via HSON nodes. 

 hson.transform guides the developer through a logical sequence of method choices that pass input source data, specifies final output format and, includes options for serialization and parsing, in a type-safe and predictable chain.

The API works with a single, stateful context object called the FrameConstructor which holds all the data for a single transformation job:

interface FrameConstructor {
    input: string | Element; // The original raw input
    node: HsonNode;         // The parsed, in-memory HSON tree
    hson?: string;          // The result of serializing to HSON (if requested)
    html?: string;          // The result of serializing to HTML (if requested)
    json?: string;          // The result of serializing to JSON (if requested)
    options?: FrameOptions; // Formatting options like `spaced` or `linted`
};

This single object is the "source of truth" that is passed between each constructor function in the chain.

# Four-Stage Constructor Pipeline

The fluent API (.fromHTML(...).toJSON()...) is implemented as a series of factory functions, each returning an object with the methods for the next logical step.

# Stage 1: Source Constructor (construct_1_source)

* API Methods: .fromHTML(), .fromJSON(), .fromHSON()

* Purpose: This is the entry point. Its job is to ingest raw data and convert it into the universal $HsonNode$ model.

* Usage:

A user begins calling a method like HSON.transform.fromHTML().

This method calls the appropriate low-level parser (parse_html, parse_json, etc.) and initializes the FrameConstructor object, populating its input and node properties.

This newly created frame is passed to the next stage, the output target.

# Stage 2: Output Target (construct_2_output)

* API Methods: .toHTML(), .toJSON(), .toHSON()

* Purpose: specifies desired final output format and performs the core data conversion.

* Action:

- A user calls a method like .toJSON().

- This method takes the $HsonNode$ tree from the frame it received from Stage 1.

- It calls the appropriate low-level serializer (serialize_json). This is an "eager" conversion—the work happens here, not at the end.

- It creates an updated frame by adding the resulting JSON string to the frame.json property.

- It bundles this updatedFrame with the user's choice ('json') into a FrameRender context object.

- It returns a merged object containing all the methods from both Stage 3 and Stage 4, allowing the user to either add options or finish immediately.

# Stage 3: Options (construct_3_options)

* API Methods: .spaced(), .linted(), .withOptions()

* Purpose: An optional stage to apply formatting rules to the output.

* Action:

- A user calls a method like .spaced().

- This method receives the FrameRender context from Stage 2.

- It modifies the frame.options property inside that context (e.g., frame.options.spaced = true).

- It then returns the methods from Stage 4, passing the modified context along.

# Stage 4: Render Target (construct_4_render)

* API Methods: .serialize(), .parse()

* Purpose: The terminal action that produces the final output.

* Action:

- A user calls a method like .serialize().
- This method has access to the final, fully configured FrameRender context from its closure.
- It looks at the context.output flag (e.g., 'json') to know what kind of output is desired.
- It retrieves the corresponding pre-computed string from the context.frame (e.g., context.frame.json).
- It applies any formatting from context.frame.options and returns the final string. The .parse() method does the same, but returns a parsed object instead of a string.

# Example

HSON.transform
    .fromHTML(html)
    .toJSON()
    .serialize()


.fromHTML(html): constructSource_1 runs parse_html, creates frame, returns constructOutput_2(frame).

.toJSON(): constructOutput_2 runs serialize_json, adds the result to a new frame, bundles it into a context, and returns the methods for stages 3 & 4.

.serialize(): A method from constructRender_4 runs. It sees the output format in the context is 'json', retrieves the pre-computed frame.json string, and returns it.

This architecture creates a clear, robust, and type-safe pipeline that guides the user through a complex data transformation process with a simple and intuitive chain of commands.