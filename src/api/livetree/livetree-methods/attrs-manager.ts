import { HsonAttrs, HsonNode, Primitive } from "../../../types-consts";
import { parse_style_string } from "../../../utils/attrs-utils/parse-style.utils";
import { serialize_style } from "../../../utils/attrs-utils/serialize-css.utils";
import { element_for_node } from "../../../utils/tree-utils/node-map-helpers.utils";
import { LiveTree } from "../livetree";
import { StyleObject2 } from "./style-manager2.utils";

/**
 * Single-attr write for one node, with style-awareness and DOM sync.
 *
 * Semantics:
 * - value === null or false  -> remove attribute
 * - value === true or name   -> boolean-present attr (empty string)
 * - value is other           -> normal string value
 *
 * Special case: "style"
 * - Node stores a StyleObject2
 * - DOM gets canonical CSS text via serialize_style()
 */
export function applyAttrToNode(
  node: HsonNode,
  name: string,
  value: Primitive | undefined,
): void {
  if (!node._attrs) node._attrs = {};
  const attrs = node._attrs as HsonAttrs & { style?: StyleObject2 };

  const key = name.toLowerCase();
  const el = element_for_node(node) as HTMLElement | undefined;

  // normalize undefined -> null
  if (value === undefined) {
    value = null;
  }

  // ---- remove / delete ----------------------------------------
  if (value === null || value === false) {
    if (key === "style") {
      delete attrs.style;
      if (el) el.removeAttribute("style");
    } else {
      delete (attrs as any)[key];
      if (el) el.removeAttribute(key);
    }
    return;
  }

  // ---- boolean-present attribute ------------------------------
  if (value === true) {
    if (key === "style") {
      // treat boolean style as "clear style"
      delete attrs.style;
      if (el) el.removeAttribute("style");
    } else {
      // CANONICAL: store flag as key="key" in _attrs
      (attrs as any)[key] = key;
      if (el) el.setAttribute(key, key);
    }
    return;
  }

  // ---- normal value -------------------------------------------
  const s = String(value);

  if (key === "style") {
    const cssObj = parse_style_string(s) as StyleObject2;
    attrs.style = cssObj;

    const cssText = serialize_style(cssObj);
    if (el) {
      if (cssText) {
        el.setAttribute("style", cssText);
      } else {
        el.removeAttribute("style");
      }
    }
  } else {
    (attrs as any)[key] = s;
    if (el) el.setAttribute(key, s);
  }
}

/**
 * Read a single attribute from the node, mirroring the “node is source of truth” idea.
 *
 * For "style", returns CSS text (serialized) if the node stores a StyleObject2.
 */
export function readAttrFromNode(
  node: HsonNode,
  name: string,
): Primitive | undefined {
  const attrs = node._attrs;
  if (!attrs) return undefined;

  const key = name.toLowerCase();
  const raw = (attrs as any)[key];

  if (raw == null) return undefined;

  if (key === "style" && typeof raw === "object") {
    // convert StyleObject2 → CSS text
    return serialize_style(raw as Record<string, string>);
  }

  return raw as Primitive;
}

export function setAttrsImpl(
  tree: LiveTree,
  nameOrMap: string | Record<string, string | boolean | null>,
  value?: Primitive
): LiveTree {
  const node = tree.node; // mutators are allowed to throw if unbound

  if (typeof nameOrMap === "string") {
    applyAttrToNode(node, nameOrMap, (value) ?? null);
    return tree;
  }

  for (const [k, v] of Object.entries(nameOrMap)) {
    applyAttrToNode(node, k, (v) ?? null);
  }
  return tree;
}

export function removeAttrImpl(tree: LiveTree, name: string): LiveTree {
  const node = tree.node;
  applyAttrToNode(node, name, null);
  return tree;
}

export function setFlagsImpl(tree: LiveTree, ...names: string[]): LiveTree {
  const node = tree.node;
  for (const n of names) {
    applyAttrToNode(node, n, true);
  }
  return tree;
}

export function clearFlagsImpl(tree: LiveTree, ...names: string[]): LiveTree {
  const node = tree.node;
  for (const n of names) {
    applyAttrToNode(node, n, null);
  }
  return tree;
}

export function getAttrImpl(tree: LiveTree, name: string): Primitive | undefined {
  return readAttrFromNode(tree.node, name);
}
