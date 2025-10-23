import { Primitive } from '../../core/types-consts/core.types'
import { is_Primitive } from '../../core/utils/guards.core.utils';
import { ELEM_TAG, EVERY_VSN, OBJ_TAG, ROOT_TAG, STR_TAG, VAL_TAG } from '../../types-consts/constants';
import { build_wire_attrs } from '../../utils/build-wire-attrs.utils';
import { escape_html } from '../../utils/escape-html.utils';
import { make_string } from '../../utils/make-string.utils';
import { _snip } from '../../utils/snip.utils';
import { _throw_transform_err } from '../../utils/throw-transform-err.utils';
import { is_Node } from '../../utils/node-guards.new.utils';
import { assert_invariants } from '../../diagnostics/assert-invariants.utils';
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

  const RAWTEXT = new Set(["style", "script"]);

// Collects verbatim text from a subtree (no escaping, no trim)
function collect_raw_text(nodes: (HsonNode | Primitive)[] | undefined): string {
  if (!nodes || !nodes.length) return "";
  let out = "";
  for (const ch of nodes) {
    if (is_Node(ch)) {
      if (ch._tag === STR_TAG) {
        const seg = (ch._content?.[0] ?? "") as unknown;
        out += typeof seg === "string" ? seg : String(seg);
      } else {
        // descend, in case someone wrapped _str in an extra node
        out += collect_raw_text(ch._content as any);
      }
    } else {
      // primitive leaf: take as-is (no entity escaping)
      out += String(ch);
    }
  }
  return out;
}

function escape_attr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}


// DROP-IN: serialize_xml + serialize_html (2.0) — with fixes
// - _str melts to bare text
// - _val is literal (<_val>…</_val>)
// - _elem flattens; _root melts its single cluster
// - _obj property loop is total; no silent self-closing when a child exists
// - self-close only when computed inner === ""
// - consistent primitive escaping via primitive_to_xml
// Assumes these exist in your module scope:
//   - is_Primitive, is_Node, build_wire_attrs, escape_html, escape_attr,
//     clone_node, assert_invariants, _throw_transform_err, make_string
//   - constants: STR_TAG, VAL_TAG, ROOT_TAG, OBJ_TAG, ARR_TAG, II_TAG, ELEM_TAG, EVERY_VSN
// ---------------------------------------------------------------------------

function primitive_to_xml(p: Primitive): string {
  // same semantics you had; strings escape as text, others stringify+escape
  if (typeof p === 'string') return escape_html(p);
  return escape_html(String(p));
}

export function serialize_xml(node: HsonNode | Primitive | undefined): string {
  if (is_Primitive(node)) return primitive_to_xml(node);
  if (node === undefined) {
    _throw_transform_err('undefined node received', 'serialize_html', node);
  }

  const { _tag: tag, _content: content = [] } = node;

  // CHANGED(label): correct origin label for error
  if (tag.startsWith('_') && !EVERY_VSN.includes(tag)) {
    _throw_transform_err(`unknown VSN-like tag: <${tag}>`, 'serialize_html');
  }

  switch (tag) {
    // CHANGED: _str always melts to bare text
    case STR_TAG: {
      if (!content || content.length !== 1 || typeof content[0] !== 'string') {
        _throw_transform_err('<_str> must contain exactly one string', 'serialize_html');
      }
      const s = content[0] as string;

      // Special case: empty string must be visible in HTML
      if (s === '') {
        return '""'; // two quotes; will be decoded by HTML parser back to _str([""])
      }

      // Non-empty strings remain melted as plain text
      return escape_html(s);
    }

    // CHANGED: keep <_val> literal for round-trip typing
    case VAL_TAG: {
      if (!content || content.length !== 1) {
        _throw_transform_err('<_val> must contain exactly one value', 'serialize_html');
      }
      const v = content[0] as Primitive;
      return `<${VAL_TAG}>${escape_html(String(v))}</${VAL_TAG}>`;
    }

    // flatten element cluster
    case ELEM_TAG: {
      return (content as (HsonNode | Primitive)[]).map(ch => serialize_xml(ch as any)).join('\n');
    }

    // melt _root (must have exactly one cluster child)
    case ROOT_TAG: {
      const kids = content as HsonNode[];
      if (kids.length !== 1) {
        _throw_transform_err('_root must have exactly one child', 'serialize_html');
      }
      return serialize_xml(kids[0]);
    }

    // object cluster → each property becomes an HTML element
    case OBJ_TAG: {
      const props = (content as HsonNode[]) ?? [];
      const inner = props.map(serialize_xml).join('\n');
      return `<${OBJ_TAG}>\n${inner}\n</${OBJ_TAG}>`;
    }

  }
  // --------------- default path: literal tags (incl. _arr/_ii and normal HTML) ---------------

  let openAttrs = `<${tag}`;
  const attrs = build_wire_attrs(node);
  if (tag === "svg") {
  // ensure default SVG ns on the root svg element if not present
  if (!("xmlns" in attrs)) attrs.xmlns = "http://www.w3.org/2000/svg";
  // only add xlink ns if you still serialize any xlink:* (ideally you don’t)
}

  for (const k of Object.keys(attrs).sort()) {
    openAttrs += ` ${k}="${escape_attr(attrs[k])}"`;
  }

  const kids = (content as (HsonNode | Primitive)[]) ?? [];

  // RAW-TEXT MODE: style/script → emit verbatim, no escaping/trim/collapse
  let inner: string;
  if (RAWTEXT.has(tag.toLowerCase())) {
    inner = collect_raw_text(kids)
      .replace(/<\/(style|script)/gi, "<\\/$1>"); // guard early close
  } else {
    inner = kids.map(ch => is_Node(ch) ? serialize_xml(ch as HsonNode)
      : primitive_to_xml(ch as Primitive))
      .join("");
  }

  return `${openAttrs}>${inner}</${tag}>`;
}

export function serialize_html($node: HsonNode | Primitive): string {

  const clone = clone_node($node);
  if (!is_Node(clone)) {
    _throw_transform_err('input node cannot be undefined for node_to_html', 'serialize_html', make_string($node));
  }

  // keep your tree assertions; they’ll throw loudly if structure is off
  assert_invariants(clone, 'serialize_html');

  const xmlString = serialize_xml(clone);

  // HTML boolean attrs: key="key" → key
  const htmlString = xmlString.replace(/\b([^\s=]+)="\1"/g, '$1');

  // guard: never let literal <_str> leak into output
  if (/<\s*_str\b/.test(htmlString)) {
    _throw_transform_err('literal <_str> leaked into HTML output', 'serialize_html', htmlString.slice(0, 400));
  }
  return `<${ROOT_TAG}>\n${htmlString}\n</${ROOT_TAG}>`;

}
