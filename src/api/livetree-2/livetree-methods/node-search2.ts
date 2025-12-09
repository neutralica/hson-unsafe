// node-search.ts

import { HsonNode, HsonQuery } from "../../../types-consts";
import { STR_TAG } from "../../../types-consts/constants";
import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { getElementForNode } from "../../../utils/tree-utils/node-map-helpers.utils";

const isRegExp = (v: unknown): v is RegExp =>
  Object.prototype.toString.call(v) === "[object RegExp]";

// optional text extractor
function nodeText(n: HsonNode): string {
  const el = getElementForNode(n);
  if (el) return el.textContent ?? "";

  const kids = (n._content ?? []).filter(is_Node);
  for (const k of kids) {
    if (k._tag === STR_TAG && typeof k._content?.[0] === "string") {
      return k._content[0] as string;
    }
  }
  return "";
}

// only wire this up if HsonQuery actually has a text field
function matchText(node: HsonNode, query: HsonQuery): boolean {
  const qText = (query as any).text;
  if (qText == null) return true;

  const t = nodeText(node);

  if (isRegExp(qText)) {
    return qText.test(t);
  }
  if (typeof qText === "string") {
    return t.includes(qText);
  }
  if (typeof qText === "function") {
    return !!qText(t);
  }
  return true;
}

function matchAttrs(node: HsonNode, query: HsonQuery): boolean {
  if (!query.attrs) return true;
  const na = node._attrs ?? {};

  for (const [k, qv] of Object.entries(query.attrs)) {
    const nv = (na as any)[k];

    if (qv instanceof RegExp) {
      if (typeof nv !== "string" || !qv.test(nv)) return false;
    } else if (typeof qv === "object" && qv !== null) {
      if (typeof nv !== "object" || nv === null) return false;
      for (const [sk, sv] of Object.entries(qv as Record<string, unknown>)) {
        if ((nv as any)[sk] !== sv) return false;
      }
    } else if (qv === true) {
      // flag-style: just needs to exist
      if (!(k in na)) return false;
    } else {
      if (nv !== qv) return false;
    }
  }
  return true;
}

function matchMeta(node: HsonNode, query: HsonQuery): boolean {
  if (!query.meta) return true;
  const nm = node._meta ?? {};
  const qMeta = query.meta as Record<string, unknown>;

  for (const [k, qv] of Object.entries(qMeta)) {
    const nv = (nm as any)[k];
    if (isRegExp(qv)) {
      if (typeof nv !== "string" || !qv.test(nv)) return false;
    } else if (nv !== qv) {
      return false;
    }
  }
  return true;
}

export function search_nodes(
  nodes: HsonNode[],
  query: HsonQuery,
  options: { findFirst: boolean },
): HsonNode[] {
  const results: HsonNode[] = [];

  const checkNode = (node: HsonNode): boolean => {
    const tagOK =
      !query.tag ||
      node._tag.toLowerCase() === query.tag.toLowerCase();

    return (
      tagOK &&
      matchAttrs(node, query) &&
      matchMeta(node, query) &&
      matchText(node, query)
    );
  };

  const traverse = (nodesToSearch: HsonNode[]) => {
    for (const node of nodesToSearch) {
      if (options.findFirst && results.length) return;

      if (checkNode(node)) {
        results.push(node);
        if (options.findFirst) return;
      }

      const kids = (node._content ?? []).filter(is_Node);
      if (kids.length) traverse(kids);
    }
  };

  traverse(nodes);
  return options.findFirst ? results.slice(0, 1) : results;
}