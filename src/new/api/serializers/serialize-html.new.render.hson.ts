import { Primitive } from '../../../core/types-consts/core.types.hson'
import { is_Primitive } from '../../../core/utils/guards.core.utils.hson';
import { ELEM_TAG, EVERY_VSN, STR_TAG } from '../../../types-consts/constants.hson';
import { build_wire_attrs } from '../../../utils/build-wire-attrs.utils.hson';
import { escape_html } from '../../../utils/escape-html.utils.hson';
import { make_string } from '../../../utils/make-string.utils.hson';
import { _snip } from '../../../utils/snip.utils.hson';
import { _throw_transform_err } from '../../../utils/throw-transform-err.utils.hson';
import { HsonNode_NEW } from '../../types-consts/node.new.types.hson';

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
export function serialize_xml(node: HsonNode_NEW | Primitive | undefined): string {
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
    case ELEM_TAG: { /* flatten _elem; process children directly */
      _log('list tag found; flattening')
      return content.map(child => serialize_xml(child)).join('\n');
    }
    /* the other special case is strings, which is our default assumption for html.
          strings don't need to be tagged because their type is automatically 
          assigned if no wrapper VSN (_prim, e.g.) is found 

          Primitives need to retain their types; wrap in _val as a flag. this _val VSN
          will be visible in the html, unlike _str
        */
    case STR_TAG: {
      _log('string tag found; flattening')
      if (typeof content[0] !== 'string') {
        _throw_transform_err('need a primitive in a txt node!', 'serialize_html');
      }
      return primitive_to_string(content[0] as Primitive)

    }
  }

  /* handle standard tags or non-exceptional VSNs* 
      (*ie, _obj is serialized into HTML as-is; the only special treatment it 
      gets is its contents are not  wrapped in _elem if an _obj is found*/

  let openLine = `<${tag}`;
  _log(`open TAG: ${tag}`);
  /* get attributes from _meta.attrs */

  /* build attributes from _NEW model (_attrs) + meta mapping */
  /* NOTE: XML stage prints key="value" even for flags; HTML stage trims later */
  const attrs = build_wire_attrs(node as HsonNode_NEW);
  for (const key of Object.keys(attrs).sort()) {
    const v = attrs[key];
    openLine += ` ${key}="${escape_attr(v)}"`;
  }

  /* check for void elements after adding attributes/flags */
  if (content.length === 0) {
    openLine += ' />\n'; // self-close void elements
    return openLine;
  }

  /* close tag */
  openLine += '>\n';

  const innerContent = content
    /* filter out whitespace-only string children */
    .filter(child => typeof child !== 'string' || /\S/.test(child))
    /* recursively serialize */
    .map(child => serialize_xml(child))
    .join('');

  const lineClose = `</${tag}>\n`;

  return openLine + innerContent + lineClose;
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
export function serialize_html_NEW($node: HsonNode_NEW | Primitive): string {
  if ($node === undefined) {
    _throw_transform_err('input node cannot be undefined for node_to_html', 'serialize-html', $node);
  }
  if (_VERBOSE) {
    console.groupCollapsed('---> serializing to html')
    console.log('input node: ')
    console.log(make_string($node))
    console.groupEnd();
  }
  const xmlString = serialize_xml($node);

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