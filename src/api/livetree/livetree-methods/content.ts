// content.ts

import { HsonAttrs, HsonNode } from "../../../types-consts/node.types";
import { STR_TAG } from "../../../types-consts/constants";
import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { make_string } from "../../../utils/primitive-utils/make-string.nodes.utils";
import { _throw_transform_err } from "../../../utils/sys-utils/throw-transform-err.utils";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers.utils";
import { make_leaf } from "../../parsers/parse-tokens.new.transform";
import { Primitive } from "../../../core/types-consts/core.types";

/**
 * Replace a node's content with a single text/leaf node derived from `value`
 * and mirror that into the DOM element's `textContent`.
 *
 * Behavior:
 * - Creates a leaf via `make_leaf(value)` and replaces `node._content` with
 *   a single-element array containing that leaf.
 * - Looks up the corresponding DOM element via `element_for_node(node)`.
 * - If the element is missing, throws a transform error including the node's
 *   `_tag` and `_meta._quid` (when available).
 * - For the DOM:
 *   - `value === null` → `textContent` is set to an empty string.
 *   - Otherwise → `textContent` is set to `String(value)`.
 *
 * This treats the node + DOM as tightly coupled: any failure to find a
 * mapped element is considered a structural error.
 *
 * @param node - The HSON node whose content and mapped element text are updated.
 * @param value - The primitive value to store as a leaf and render as text.
 */
export function set_node_content(node: HsonNode, value: Primitive): void {
    const leaf = make_leaf(value);
    node._content = [leaf];

    const el = element_for_node(node);
    if (!el) {
        const quid = node._meta?._quid ?? "<no-quid>";
        _throw_transform_err(
            `missing element for node (tag=${node._tag}, quid=${quid})`,
            "setNodeContent",
            make_string(node),
        );
    }

    (el as HTMLElement).textContent = value === null ? "" : String(value);
}

/**
 * Return all rendered text under a node, preferring the DOM as the
 * ground truth when available.
 *
 * Behavior:
 * - If a DOM element is currently mounted for the node, returns its
 *   `textContent` (or `""` if null), treating the DOM as authoritative.
 * - If no DOM element is found, performs a depth-first walk of the HSON
 *   subtree, concatenating the string payloads of `_str` virtual nodes:
 *   - Only children that are HSON nodes (`is_Node`) are considered.
 *   - For each `_str` node, takes the first `_content` entry when it
 *     is a string and appends it to the result.
 *   - Recurses into non-`_str` child nodes.
 *
 * @param node - The HSON node whose textual content is being read.
 * @returns The concatenated text from either the DOM or the HSON tree.
 */
export function get_node_text(node: HsonNode): string {
    // Prefer DOM if present – it's the ground truth for rendered text.
    const el = element_for_node(node);
    if (el) {
        return el.textContent ?? "";
    }

    // Fallback: depth-first walk over HSON, collecting _str nodes.
    let out = "";

    const walk = (n: HsonNode): void => {
        const content = n._content ?? [];
        for (const child of content) {
            if (!is_Node(child)) continue;

            if (child._tag === STR_TAG) {
                const first = child._content?.[0];
                if (typeof first === "string") {
                    out += first;
                }
                continue;
            }

            // recurse into non-_str children
            walk(child);
        }
    };

    walk(node);
    return out;
}
/**
 * Set a "form value" for a node, syncing both the node's attributes and,
 * when appropriate, the associated form control element in the DOM.
 *
 * Behavior:
 * - Ensures `node._attrs` exists and writes `value` into `node._attrs.value`.
 * - Looks up the associated DOM element via `element_for_node(node)`:
 *   - If no element is found:
 *     - If `opts?.silent === true`, the function returns after updating
 *       the HSON attributes (no error).
 *     - Otherwise, throws a transform error with tag and QUID context.
 *   - If an element is found and it is an `HTMLInputElement`,
 *     `HTMLTextAreaElement`, or `HTMLSelectElement`, sets `el.value = value`.
 *   - For other element types, only the HSON attribute is updated; the DOM
 *     element is left unchanged.
 *
 * This is intended for elements that behave like form controls, but does
 * not enforce that at the type level.
 *
 * @param node - The HSON node representing a form-like element.
 * @param value - The string value to assign as the form value.
 * @param opts - Optional behavior flags.
 * @param opts.silent - When true, suppresses the error if no DOM element
 *                      is currently associated with the node.
 */
export function set_node_form_value(
    node: HsonNode,
    value: string,
    opts?: { silent?: boolean },
): void {
    if (!node._attrs) {
        node._attrs = {} as HsonAttrs;
    }

    (node._attrs as HsonAttrs).value = value;

    const el = element_for_node(node);
    if (!el) {
        if (opts?.silent) return;
        const quid = node._meta?._quid ?? "<no-quid>";
        _throw_transform_err(
            `missing element for node (tag=${node._tag}, quid=${quid})`,
            "setNodeFormValue",
            make_string(node),
        );
    }

    if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
    ) {
        el.value = value;
    }
}

/**
 * Read a "form value" from a node, preferring the DOM form control when
 * available and falling back to the node's stored attributes.
 *
 * Behavior:
 * - If a DOM element is present and is an `HTMLInputElement`,
 *   `HTMLTextAreaElement`, or `HTMLSelectElement`, returns `el.value`
 *   (or `""` if null/undefined).
 * - Otherwise, reads `node._attrs.value`:
 *   - If `_attrs` is missing or `.value` is `null`/`undefined`,
 *     returns `""`.
 *   - Otherwise returns `String(raw)`.
 *
 * This keeps DOM and HSON in sync conceptually while allowing the node
 * to carry a value even when no element is mounted.
 *
 * @param node - The HSON node from which to read the form value.
 * @returns The form value as a string, or `""` when no value is present.
 */
export function get_node_form_value(node: HsonNode): string {
    const el = element_for_node(node);
    if (
        el &&
        (el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement ||
            el instanceof HTMLSelectElement)
    ) {
        return el.value ?? "";
    }

    const attrs = node._attrs as HsonAttrs | undefined;
    if (!attrs) return "";
    const raw = (attrs as any).value;
    return raw == null ? "" : String(raw);
}


