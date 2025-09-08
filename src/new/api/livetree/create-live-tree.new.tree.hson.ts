// create-live-tree.new.ts

import { Primitive } from "../../../core/types-consts/core.types.hson";
import { NODE_ELEMENT_MAP } from "../../../old/types/node-constants.old";
import { STR_TAG, VAL_TAG } from "../../../types-consts/constants.hson";
import { serialize_style } from "../../../utils/serialize-css.utils.hson";
import { HsonNode_NEW } from "../../types-consts/node.new.types.hson";
import { is_Node_NEW } from "../../utils/node-guards.new.utils.hson";

/**
 * render NEW nodes directly to DOm
 * VSNs (_root/_obj/_arr/_elem) are virtual and never become DOM elements
 */
export function create_live_tree_NEW(node: HsonNode_NEW | Primitive): Node {
  // NEW: if not a NEW node, render as text
  if (!is_Node_NEW(node)) {
    return document.createTextNode(String(node ?? ""));
  }

  const n = node as HsonNode_NEW;

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
        const payload = (is_Node_NEW(ii) && Array.isArray(ii._content)) ? ii._content[0] : null;
        if (payload != null) frag.appendChild(create_live_tree_NEW(payload as any));
      }
      return frag;
    }

    // NEW: _root/_obj/_elem → render their children directly
    for (const child of n._content ?? []) {
      frag.appendChild(create_live_tree_NEW(child as any));
    }
    return frag;
  }

  // NEW: standard element
  const el = document.createElement(n._tag);

  // NEW: link node↔element (same map is fine; key is object identity)
  NODE_ELEMENT_MAP.set(n as any, el);

  // NEW: reflect ONLY _attrs
  const a = n._attrs;
  if (a) {
    for (const [key, raw] of Object.entries(a)) {
      if (raw == null) continue;

      // NEW: style may be string or object
      if (key === "style") {
        if (typeof raw === "string") {
          el.setAttribute("style", raw);
        } else if (raw && typeof raw === "object") {
          el.setAttribute("style", serialize_style(raw as Record<string, string>));
        }
        continue;
      }

      // NEW: boolean presence attrs
      if (raw === true) { el.setAttribute(key, ""); continue; }
      if (raw === false) { /* omit */ continue; }

      // everything else → string
      el.setAttribute(key, String(raw));
    }
  }

  // NEW: NEVER reflect _meta to DOM (including data-_*)
  // (Those are for invariants/round-trips only.)

  // NEW: children — either a single VSN wrapper or direct content
  const kids = n._content ?? [];
  if (kids.length === 1 && is_Node_NEW(kids[0]) &&
      (kids[0]._tag === "_obj" || kids[0]._tag === "_elem" || kids[0]._tag === "_arr")) {
    // unwrap the container
    const container = kids[0];
    if (container._tag === "_arr") {
      for (const ii of container._content ?? []) {
        const payload = (is_Node_NEW(ii) && Array.isArray(ii._content)) ? ii._content[0] : null;
        if (payload != null) el.appendChild(create_live_tree_NEW(payload as any));
      }
    } else {
      for (const c of container._content ?? []) el.appendChild(create_live_tree_NEW(c as any));
    }
  } else {
    for (const c of kids) el.appendChild(create_live_tree_NEW(c as any));
  }

  return el;
}
