// create-live-tree.new.ts

import { create_el_safe, set_attrs_safe } from "../../safety/safe-mount.safe";
import { HsonNode, Primitive } from "../../types-consts";
import {
  _DATA_QUID,   // NOTE: can now be removed if not used elsewhere in this file
  ARR_TAG,
  ELEM_TAG,
  OBJ_TAG,
  ROOT_TAG,
  STR_TAG,
  VAL_TAG,
} from "../../types-consts/constants";
import { SVG_NS } from "../../utils/node-utils/node-from-svg.utils";
import { is_Node } from "../../utils/node-utils/node-guards.new.utils";
import { linkNodeToElement } from "../../utils/tree-utils/node-map-helpers.utils";
// CHANGED: removed ensure_quid, NODE_ELEMENT_MAP, map_set imports

/**
 * Render NEW nodes directly to DOM.
 * VSNs (_root/_obj/_arr/_elem) are virtual and never become DOM elements.
 *
 * IMPORTANT: no quid logic here; LiveTree is responsible for quids.
 */
export function create_live_tree(
  node: HsonNode | Primitive,
  parentNs: "html" | "svg" = "html"
): Node {
  // Non-node primitives → plain text
  if (!is_Node(node)) {
    return document.createTextNode(String(node ?? ""));
  }

  const n = node as HsonNode;

  // Primitive wrappers → text
  if (n._tag === STR_TAG || n._tag === VAL_TAG) {
    const v = n._content?.[0];
    return document.createTextNode(String(v ?? ""));
  }

  // VSNs: unwrap into a fragment
  if (
    n._tag === ROOT_TAG ||
    n._tag === OBJ_TAG ||
    n._tag === ELEM_TAG ||
    n._tag === ARR_TAG
  ) {
    const frag = document.createDocumentFragment();

    if (n._tag === ARR_TAG) {
      // _arr contains <_ii> items; unwrap each item’s single child
      for (const ii of n._content ?? []) {
        const payload =
          is_Node(ii) && Array.isArray(ii._content) ? ii._content[0] : null;
        if (payload != null) {
          frag.appendChild(create_live_tree(payload as HsonNode | Primitive, parentNs));
        }
      }
      return frag;
    }

    // _root/_obj/_elem → render their children directly
    for (const child of n._content ?? []) {
      frag.appendChild(create_live_tree(child as HsonNode | Primitive, parentNs));
    }
    return frag;
  }

  // REAL ELEMENT NODE --------------------------------------

  // decide namespace for *this* element + descendants
  const ns: "html" | "svg" = n._tag === "svg" ? "svg" : parentNs;

  // create element respecting namespace
  const el: Element =
    ns === "svg"
      ? document.createElementNS(SVG_NS, n._tag)
      : (create_el_safe(n._tag) as HTMLElement);

  // single source of truth for mapping HsonNode -> Element
  linkNodeToElement(n, el);

  // reflect ONLY _attrs
  const a = n._attrs;
  if (a) {
    for (const [key, raw] of Object.entries(a)) {
      if (raw == null) continue;

      // style handling
      if (key === "style") {
        const elt = el as HTMLElement | SVGElement;

        if (typeof raw === "string") {
          elt.style.cssText = raw;
        } else if (raw && typeof raw === "object") {
          const obj = raw as Record<string, string | number | null>;
          for (const [prop, v] of Object.entries(obj)) {
            const val = v == null ? "" : String(v);
            if (val === "") elt.style.removeProperty(prop);
            else elt.style.setProperty(prop, val);
          }
        }
        continue;
      }

      // boolean presence attrs
      if (raw === true) {
        if (ns === "svg") {
          el.setAttribute(key, "");
        } else {
          set_attrs_safe(el as HTMLElement, key, "");
        }
        continue;
      }
      if (raw === false) {
        continue;
      }

      // everything else → string
      const str = String(raw);
      if (ns === "svg") {
        el.setAttribute(key, str);
      } else {
        set_attrs_safe(el as HTMLElement, key, str);
      }
    }
  }

  // children — either a single VSN wrapper or direct content
  const kids = n._content ?? [];
  if (
    kids.length === 1 &&
    is_Node(kids[0]) &&
    (kids[0]._tag === OBJ_TAG ||
      kids[0]._tag === ELEM_TAG ||
      kids[0]._tag === ARR_TAG)
  ) {
    const container = kids[0];

    if (container._tag === ARR_TAG) {
      for (const ii of container._content ?? []) {
        const payload =
          is_Node(ii) && Array.isArray(ii._content) ? ii._content[0] : null;
        if (payload != null) {
          el.appendChild(create_live_tree(payload as HsonNode | Primitive, ns));
        }
      }
    } else {
      for (const c of container._content ?? []) {
        el.appendChild(create_live_tree(c as HsonNode | Primitive, ns));
      }
    }
  } else {
    for (const c of kids) {
      el.appendChild(create_live_tree(c as HsonNode | Primitive, ns));
    }
  }

  return el;
}
