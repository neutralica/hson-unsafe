// create-live-tree.new.ts

import { ensure_quid } from "../../quid/data-quid.quid";
import { create_el_safe, set_attrs_safe } from "../../safety/safe-mount.safe";
import { HsonNode, Primitive } from "../../types-consts";
import { _DATA_QUID, STR_TAG, VAL_TAG } from "../../types-consts/constants";
import { NODE_ELEMENT_MAP } from "../../types-consts/constants";
import { map_set } from "../../utils/node-utils/lookup-element.html.utils";
import { SVG_NS } from "../../utils/node-utils/node-from-svg.utils";
import { is_Node } from "../../utils/node-utils/node-guards.new.utils";

/**
 * render NEW nodes directly to DOm
 * VSNs (_root/_obj/_arr/_elem) are virtual and never become DOM elements
 */
// parent namespace param with default, everything else stays structurally the same
export function create_live_tree(
  node: HsonNode | Primitive,
  parentNs: "html" | "svg" = "html"
): Node {
  // NEW: if not a NEW node, render as text
  if (!is_Node(node)) {
    return document.createTextNode(String(node ?? ""));
  }

  const n = node as HsonNode;

  // NEW: primitive wrappers → single text node
  if (n._tag === STR_TAG || n._tag === VAL_TAG) {
    const v = n._content?.[0];
    return document.createTextNode(String(v ?? ""));
  }

  // NEW: unwrap virtual structure nodes via a fragment
  if (n._tag === "_root" || n._tag === "_obj" || n._tag === "_elem" || n._tag === "_arr") {
    const frag = document.createDocumentFragment();

    if (n._tag === "_arr") {
      // _arr contains <_ii> items; unwrap each item’s single child
      for (const ii of n._content ?? []) {
        const payload = (is_Node(ii) && Array.isArray(ii._content)) ? ii._content[0] : null;
        if (payload != null) frag.appendChild(create_live_tree(payload as any, parentNs)); // CHANGED: pass ns
      }
      return frag;
    }

    // _root/_obj/_elem → render their children directly
    for (const child of n._content ?? []) {
      frag.appendChild(create_live_tree(child as any, parentNs)); // CHANGED: pass ns
    }
    return frag;
  }

  // REAL ELEMENT NODE --------------------------------------

  // decide namespace for *this* element + its descendants
  // <svg> always switches to SVG; children inherit svg unless they explicitly introduce foreignObject later
  const ns: "html" | "svg" = n._tag === "svg" ? "svg" : parentNs;

  // create element respecting namespace
  const el: Element =
    ns === "svg"
      ? document.createElementNS(SVG_NS, n._tag)
      : create_el_safe(n._tag) as HTMLElement;

  // map node → element (unchanged)
  map_set(node as unknown as object, el);
  const q = ensure_quid(n, { persist: true });

  // QUID is a regular data-* attr; safe to always apply the same way
  set_attrs_safe(el as HTMLElement, `${_DATA_QUID}`, q);
  NODE_ELEMENT_MAP.set(n, el);

  // reflect ONLY _attrs
  const a = n._attrs;
  if (a) {
    for (const [key, raw] of Object.entries(a)) {
      if (raw == null) continue;

      // special style handling (same logic, works for HTML + SVG since both expose .style)
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
          el.setAttribute(key, "");           // SVG path: no HTML normalization
        } else {
          set_attrs_safe(el as HTMLElement, key, ""); // existing HTML path
        }
        continue;
      }
      if (raw === false) {
        continue;
      }

      // everything else → string
      const str = String(raw);
      if (ns === "svg") {
        // CRITICAL: no name munging, keep viewBox exactly as node_from_svg produced it
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
    (kids[0]._tag === "_obj" || kids[0]._tag === "_elem" || kids[0]._tag === "_arr")
  ) {
    // unwrap the container
    const container = kids[0];
    if (container._tag === "_arr") {
      for (const ii of container._content ?? []) {
        const payload = (is_Node(ii) && Array.isArray(ii._content)) ? ii._content[0] : null;
        if (payload != null) el.appendChild(create_live_tree(payload as any, ns)); // CHANGED: pass ns
      }
    } else {
      for (const c of container._content ?? []) {
        el.appendChild(create_live_tree(c as any, ns)); // CHANGED: pass ns
      }
    }
  } else {
    for (const c of kids) {
      el.appendChild(create_live_tree(c as any, ns)); // CHANGED: pass ns
    }
  }

  return el;
}
