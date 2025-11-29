SVG handling--cleaned up one of the largest remaining seams between your HTML and SVG handling.

Progress this session
• SVG detection added to construct_tree.fromHTML()
We now branch early if the input is SVG markup (isSvgMarkup). SVG skips parse_html entirely.
• Implemented node_from_svg (formerly node_from_dom / hydrate_from_dom)

Converts an SVG DOM element directly into a correct HSON node:
– preserves namespace
– preserves camel-cased SVG attributes (viewBox, preserveAspectRatio, etc.)
– produces NEW-spec _attrs / _content / _tag nodes
– bypasses the HTML-normalizing pipeline
• Fixed the namespace handling

SVGs maintain xmlns="http://www.w3.org/2000/svg" during both parsing and hydration.
_meta.ns was removed in favor of serialized xmlns= attributes, matching NEW rules.
• Unified hydration path: create_live_tree is now the single constructor
– SVG and HTML both hydrate through the same function
– recursion and VSN unwrapping were cleaned up
– attributes are now applied directly without the HTML-specific coercions
– SVG children now render correctly
• Removed build_element()
– no longer needed
– superseded by the unified create_live_tree
– eliminates conflicting hydration paths and namespace bugs
• Corrected NODE_ELEMENT_MAP typing
– moved from Map<*, HTMLElement> to Map<*, Element>
– fixed downstream typing issues (appendChild, replaceWith, setAttribute)
– ensured LiveTree APIs work against both SVG and HTML elements
• Fixed the viewBox coercion bug
– it was caused by HTML-kebab normalization in the HTML path
– solved by skipping HTML normalization for SVG content entirely
– patched create_live_tree to preserve casing precisely
• SVG rendering works again
– flowers now display properly
– correct namespace and attributes
– colors, transforms, and shapes intact
– no more invisible elements or lowercase-attribute breakage
• Revised error handling around findAll
– clarified the semantics of returning an empty selection
– improved type guarantees on operations like at() and count()


 outcome
I now have a fully working SVG pipeline inside HSON’s LiveTree system:
SVG → DOM → HSON → LiveTree → DOM round-trip works
SVG markup parses without HTML interference
LiveTrees can represent, manipulate, and re-insert SVG into the document exactly as they do HTML
hydration is unified, predictable, and spec-compliant
flower generator works using the official pipeline instead of a one-off parser
