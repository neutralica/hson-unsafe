// create-live-tree.new.ts

import { ensure_quid } from "../../quid/data-quid.quid";
import { create_el_safe, set_attrs_safe } from "../../safety/safe-mount.safe";
import { HsonNode, Primitive } from "../../types-consts";
import { _DATA_QUID, STR_TAG, VAL_TAG } from "../../types-consts/constants";
import { NODE_ELEMENT_MAP } from "../../types-consts/constants";
import { map_set } from "../../utils/node-utils/lookup-element.html.utils";
import { is_Node } from "../../utils/node-utils/node-guards.new.utils";
import { serialize_style } from "../../utils/attrs-utils/serialize-css.utils";

/**
 * render NEW nodes directly to DOm
 * VSNs (_root/_obj/_arr/_elem) are virtual and never become DOM elements
 */
export function create_live_tree(node: HsonNode | Primitive): Node {
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
      // NEW: _arr contains <_ii> items; unwrap each item’s single child
      for (const ii of n._content ?? []) {
        // _ii is enforced by invariants; be defensive anyway
        const payload = (is_Node(ii) && Array.isArray(ii._content)) ? ii._content[0] : null;
        if (payload != null) frag.appendChild(create_live_tree(payload as any));
      }
      return frag;
    }

    // NEW: _root/_obj/_elem → render their children directly
    for (const child of n._content ?? []) {
      frag.appendChild(create_live_tree(child as any));
    }
    return frag;
  }
  const el = create_el_safe(n._tag) as HTMLElement;
  map_set(node as unknown as object, el);
  const q = ensure_quid(n, { persist: true });
  set_attrs_safe(el, `${_DATA_QUID}`, q);
  NODE_ELEMENT_MAP.set(n, el);


  // NEW: reflect ONLY _attrs
  const a = n._attrs;
  if (a) {
    for (const [key, raw] of Object.entries(a)) {
      if (raw == null) continue;
      if (key === "style") {
        const elt = el as HTMLElement;

        if (typeof raw === "string") {
          // Assign full declaration block; safe because it's code-side, not markup
          elt.style.cssText = raw;
        } else if (raw && typeof raw === "object") {
          const obj = raw as Record<string, string | number | null>;
          for (const [prop, v] of Object.entries(obj)) {
            const val = v == null ? "" : String(v);
            if (val === "") elt.style.removeProperty(prop);
            else elt.style.setProperty(prop, val);
          }
        }
        continue; // prevent the normal attr path
      }

      // NEW: boolean presence attrs
      if (raw === true) { set_attrs_safe(el, key, ""); continue; }
      if (raw === false) { /* omit */ continue; }

      // everything else → string
      set_attrs_safe(el, key, String(raw));
    }
  }


  // NEW: children — either a single VSN wrapper or direct content
  const kids = n._content ?? [];
  if (kids.length === 1 && is_Node(kids[0]) &&
    (kids[0]._tag === "_obj" || kids[0]._tag === "_elem" || kids[0]._tag === "_arr")) {
    // unwrap the container
    const container = kids[0];
    if (container._tag === "_arr") {
      for (const ii of container._content ?? []) {
        const payload = (is_Node(ii) && Array.isArray(ii._content)) ? ii._content[0] : null;
        if (payload != null) el.appendChild(create_live_tree(payload as any));
      }
    } else {
      for (const c of container._content ?? []) el.appendChild(create_live_tree(c as any));
    }
  } else {
    for (const c of kids) el.appendChild(create_live_tree(c as any));
  }

  return el;
}
