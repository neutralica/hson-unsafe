Summary of Progress
1. Stabilized and clarified the QUID system
Confirmed that QUIDs appear only when a node becomes a reference, not at parse time.
Verified LiveTree’s constructor was correctly stamping QUIDs through makeRef.
Re-established predictable QUID behavior without DOM leakage.
2. Consolidated the node–element mapping
Removed redundant helpers; NODE_ELEMENT_MAP now serves as the single authoritative mapping.
Ensured mapping occurs only for mounted nodes.
Unified QUID stamping with DOM-mapping logic.
3. Cleaned up LiveTree’s selection and reference model
Revisited how inputs normalize into ref-objects.
Clarified that refs hold QUIDs plus resolver functions.
Reconfirmed the intended “query → operate on selection” design.
4. Formalized SVG handling rules
Restricted safe-mode pipelines to HTML only.
Allowed SVG exclusively through UNSAFE or through VSN→SVG node generation.
Installed clear errors for accidental SVG in safe mode.
5. Reorganized fixture strategy
Grouped fixtures into safe HTML, unsafe HTML, external HTML, internal VSN HTML, and JSON-derived HTML.
Identified fixtures that must run through UNSAFE.
Reduced test noise by separating fail-by-design cases.
6. Deepened the architectural role of LiveMap
Recognized LiveMap as the JSON↔VSN↔DOM bridge rather than a simple projection engine.
Noted that LiveMap mediates data structures that HTML sanitization cannot represent.
Solidified LiveMap’s position as an architectural pillar.
7. Tightened the conceptual model of the entire system
Established stateless transformers for format conversion.
Positioned LiveTree as the DOM interaction engine.
Positioned LiveMap as the state/data interface.
Treated the IR (HSON nodes) as the system’s center of gravity rather than HTML.
Clarified QUID as a runtime-identity marker and DOM-attachment as a privilege boundary.
Current challenge
Introducing DOMPurify at the HTML boundary breaks JSON-derived tests because VSN tags resemble HTML and get stripped.
The fix centers on separating external HTML parsing (sanitize + HTML semantics) from internal IR parsing (no sanitize + VSN semantics).
This split becomes the basis for the next stage of work.