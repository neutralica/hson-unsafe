import { HsonAttrs, HsonNode, Primitive } from "../../../types-consts";
import { STR_TAG } from "../../../types-consts/constants";
import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { make_string } from "../../../utils/primitive-utils/make-string.nodes.utils";
import { _throw_transform_err } from "../../../utils/sys-utils/throw-transform-err.utils";
import { getElementForNode } from "../../../utils/tree-utils/node-map-helpers.utils";
import { make_leaf } from "../../parsers/parse-tokens.new.transform";

/**
 * Replace a node's content with a single leaf derived from `value`,
 * and mirror that into the DOM's textContent.
 *
 * - `null` → empty string in DOM.
 * - Throws if the node has no mapped DOM element.
 */
export function setNodeContent(node: HsonNode, value: Primitive): void {
    const leaf = make_leaf(value);
    node._content = [leaf];

    const el = getElementForNode(node);
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
 * Return all text under this node.
 *
 * - If DOM is mounted → use textContent (cheap, correct).
 * - Otherwise → walk HSON children and concatenate _str content.
 */
export function getNodeText(node: HsonNode): string {
    // Prefer DOM if present – it's the ground truth for rendered text.
    const el = getElementForNode(node);
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
 * Set a "form value" for node + DOM.
 *
 * - Writes `value` into node._attrs.value.
 * - If DOM element exists and is an input/textarea/select, sets `.value`.
 * - If no element and `silent !== true`, throws.
 */
export function setNodeFormValue(
    node: HsonNode,
    value: string,
    opts?: { silent?: boolean },
): void {
    if (!node._attrs) {
        node._attrs = {} as HsonAttrs;
    }

    (node._attrs as HsonAttrs).value = value;

    const el = getElementForNode(node);
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
 * Read a "form value" for node.
 *
 * - If mounted element exists and is input/textarea/select, return `.value`.
 * - Otherwise, fall back to node._attrs.value, if present.
 */
export function getNodeFormValue(node: HsonNode): string {
    const el = getElementForNode(node);
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