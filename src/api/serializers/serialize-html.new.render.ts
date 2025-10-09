import { Primitive } from '../../core/types-consts/core.types'
import { is_Primitive } from '../../core/utils/guards.core.utils';
import { ELEM_TAG, EVERY_VSN, OBJ_TAG, ROOT_TAG, STR_TAG, VAL_TAG } from '../../types-consts/constants';
import { build_wire_attrs } from '../../utils/build-wire-attrs.utils';
import { escape_html } from '../../utils/escape-html.utils';
import { make_string } from '../../utils/make-string.utils';
import { _snip } from '../../utils/snip.utils';
import { _throw_transform_err } from '../../utils/throw-transform-err.utils';
import { is_Node } from '../../utils/node-guards.new.utils';
import { assert_invariants } from '../../utils/assert-invariants.utils';
import { clone_node } from '../../utils/clone-node.utils';
import { HsonNode } from '../../types-consts/node.new.types';

const _VERBOSE = false;
const STYLE = 'color:fuschia;font-weight:400;padding:1px 3px;border-radius:4px';
// tweak _log to style every arg (incl. your prefix), no helpers:
const _log = _VERBOSE
  ? (...args: unknown[]) =>
    console.log(
      ['%c%s', ...args.map(() => '%c%o')].join(' '),
      STYLE, '[serialize-html_NEW] →',
      ...args.flatMap(a => [STYLE, a]),
    )
  : () => { };

function escape_attr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function stringify_style(obj: Record<string, string>): string {
  const toKebab = (k: string) =>
    k.replace(/[_\s]+/g, "-")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/-+/g, "-")
      .toLowerCase();

  return Object.keys(obj)
    .map(k => [toKebab(k), obj[k]] as const)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join("; ");
}


/**
 * Converts a Primitive value (or null/undefined) to its XML string representation.
 * Escapes strings, returns other primitives as strings.
 * Handles null/undefined by returning an empty string.
 * @param value The primitive value, or null, or undefined. // <-- Updated comment
 * @returns String representation for XML, or empty string for null/undefined.
 */
function primitive_to_string(p: Primitive): string {
  _log(`primitive to XML string: received:  ${p}`)
  /* catch strings */
  if (typeof p === 'string') {
    /* must be escape before rendering HTML string:
        use JSON.stringify to add the quotes, then escape the result 
          i.e.:  "1" -> "\"1\"" -> "&quot;1&quot;" */
    return escape_html(JSON.parse(JSON.stringify(p)));
  }
  /* fallback must be non-string Primitive:
        string it and escape it thusly: */
  return escape_html(String(p));
}

/**
 * serializes a Node structure into an XML-safe string fragment
 * - flattens ROOT_TAG and ELEM_TAG nodes
 * - unwraps NON_INDEX_TAG nodes
 * - renders TEXT_NODE_TAG content directly (escaped)
 * - renders other tags (including _array, _ii, _obj) literally as XML elements
 * - handles attributes and flags
 * - correctly formats void elements
 *
 * @param node the node or primitive to serialize
 * @returns an XML string fragment representing the node, or an empty string for null/undefined input
 */
export function serialize_xml(node: HsonNode | Primitive | undefined): string {
  /* catch BasicValues */
  _log(`node to XML: processing ${make_string(node)}`)

  if (is_Primitive(node)) {
    return primitive_to_string(node);
  }
  if (node === undefined) {
    _throw_transform_err('undefined node received', 'serialize_html', node);
  }
  /* handle the various VSNs */
  const { _tag: tag, _content: content = [], _meta = {} } = node;

  if (tag.startsWith("_") && !EVERY_VSN.includes(tag)) {
    _throw_transform_err(`unknown VSN-like tag: <${tag}>`, 'parse-html');
  }
  switch (tag) {
    case ELEM_TAG: { // already present; keep it
      return content.map((child) => serialize_xml(child)).join('\n');
    }

    case ROOT_TAG: {
      // _root must have exactly one cluster child: _elem | _obj | _arr
      const kids = content as HsonNode[];
      if (kids.length !== 1) {
        _throw_transform_err("_root must have exactly one child", "serialize_html");
      }
      // Melt the child cluster — do NOT emit <_root> in HTML
      return serialize_xml(kids[0] as HsonNode);
    }

    case OBJ_TAG: {
      // Melt object cluster: each property node becomes an HTML element
      const props = (content as HsonNode[]) ?? [];
      const out: string[] = [];

      for (const prop of props) {
        if (!prop || typeof prop !== "object") continue;
        const key = prop._tag;              // the element name
        const child = (prop._content ?? [])[0] as HsonNode | undefined;

        // Render the child's payload:
        // - if the child is an _obj that wraps a scalar, render that scalar
        // - otherwise serialize the child normally
        let inner = "";

        if (child) {
          if (child._tag === OBJ_TAG) {
            // look at the wrapped payload
            const g = (child._content ?? [])[0] as HsonNode | Primitive | undefined;

            // CHANGE: accept both nodes and primitives, and tolerate tag constant drift
            if (g && typeof g === "object") {
              // node payload
              if (g._tag === STR_TAG) {
                // unchanged: render the string bare
                inner = serialize_xml(g);
              } else if (g._tag === VAL_TAG) {
                // CHANGE: render primitive value *directly*, not <_val>…</_val>, to HTML-friendly text
                const pv = (g._content?.[0] as Primitive);
                inner = primitive_to_string(pv);
              } else {
                // CHANGE: fallback — serialize the inner node rather than going empty
                inner = serialize_xml(g);
              }
            } else if (g != null && typeof g !== "object") {
              // CHANGE: primitive directly inside the wrapper
              inner = primitive_to_string(g as Primitive);
            } else {
              // CHANGE: wrapper exists but empty/unknown — serialize wrapper to avoid data loss
              inner = serialize_xml(child);
            }
          } else {
            // unchanged path
            inner = serialize_xml(child);
          }
        }
      }
      return out.join("\n");
    }
    case STR_TAG: {
      if (!content || content.length !== 1 || typeof content[0] !== 'string') {
        _throw_transform_err('<_str> must contain exactly one string', 'serialize_html');
      }
      return `${escape_html(content[0] as string)}`;
    }

    case VAL_TAG: {
      if (!content || content.length !== 1) {
        _throw_transform_err('<_val> must contain exactly one value', 'serialize_html');
      }
      const v = content[0] as Primitive; // boolean | number | string | null
      return `<${VAL_TAG}>${escape_html(String(v))}</${VAL_TAG}>`;
    }
  }


  /* handle standard tags or non-exceptional VSNs* 
      (*ie, _obj is serialized into HTML as-is; the only special treatment it 
      gets is its contents are not  wrapped in _elem if an _obj is found*/
  // after: build the open head but don't close yet
  // default path for normal/void-ish HTML tags AND other literal underscored tags you didn’t special-case
  let openLine = `<${tag}`;
  const attrs = build_wire_attrs(node as HsonNode);
  for (const key of Object.keys(attrs).sort()) {
    openLine += ` ${key}="${escape_attr(attrs[key])}"`;
  }

  const kids = (content as (HsonNode | Primitive)[]) ?? [];
  const hasNodeChild = kids.some(k => is_Node);
  const hasPrimChild = kids.some(k => is_Primitive);

  if (!hasNodeChild && !hasPrimChild) {
    return `${openLine} />`;               // truly empty
  }

  const inner = kids.map(ch =>
    (typeof ch === 'object')
      ? serialize_xml(ch as HsonNode)
      : escape_html(String(ch as Primitive))
  ).join('');

  return `${openLine}>${inner}</${tag}>`;
}


/**
 *  -- converts a node to an HTML string
 * generates an intermediate XML string using node_to_xml then applies
 * minimal HTML-specific transformations (like boolean attributes)
 *
 * @param $node The Node or Primitive to serialize.
 * @returns An HTML string fragment representing the node.
 * @throws Error if input node is null or undefined, or if intermediate XML is empty/invalid (throw_transform_err)
 */
export function serialize_html($node: HsonNode | Primitive): string {
  const clone = clone_node($node);
  if (!is_Node(clone)) {
    _throw_transform_err('input node cannot be undefined for node_to_html', 'serialize-html', make_string($node));
  }
  assert_invariants(clone, 'serialize html');


  const xmlString = serialize_xml(clone);

  /*  flag trimmer transforms `key="key"` -> `key` for html boolean attributes
          this regex finds attributes name="value" where value is the same as the name
         (uses word boundary \b) */
  const htmlString = xmlString.replace(/\b([^\s=]+)="\1"/g, '$1');
  if (_VERBOSE) {
    console.groupCollapsed("returning htmlString");
    console.log(htmlString);
    console.groupEnd();
  }
  return htmlString;
}