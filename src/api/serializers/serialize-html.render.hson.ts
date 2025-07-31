import { BasicValue, HsonNode } from "../../types-consts/types.hson.js";
import { BLANK_META, ELEM_TAG, STRING_TAG } from "../../types-consts/constants.hson.js";
import { escape_html } from "../../utils/escape-html.utils.hson.js";
import { is_BasicValue, is_Node } from "../../utils/is-helpers.utils.hson.js";
import { make_string } from "../../utils/make-string.utils.hson.js";
import { serialize_css } from "../../utils/serialize-css.utils.hson.js";


const _VERBOSE = false;
const $log = _VERBOSE
  ? console.log
  : () => { };


/**
 * Converts a Primitive value (or null/undefined) to its XML string representation.
 * Escapes strings, returns other primitives as strings.
 * Handles null/undefined by returning an empty string.
 * @param value The primitive value, or null, or undefined. // <-- Updated comment
 * @returns String representation for XML, or empty string for null/undefined.
 */
function primitive_to_string(p: BasicValue): string {
  $log(`primitive to XML string: received:  ${p}`)
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
 * Serializes a Node structure into an XML-safe string fragment.
 * - Flattens ROOT_TAG and ELEM_TAG nodes.
 * - Unwraps NON_INDEX_TAG nodes.
 * - Renders TEXT_NODE_TAG content directly (escaped).
 * - Renders other tags (including _array, _ii, _obj) literally as XML elements.
 * - Handles attributes and flags.
 * - Correctly formats void elements.
 *
 * @param node The Node or Primitive to serialize.
 * @returns An XML string fragment representing the node, or an empty string for null/undefined input.
 */
export function serialize_xml(node: HsonNode | BasicValue | undefined): string {
  /* catch BasicValues */
  $log(`node to XML: processing ${make_string(node)}`)

  if (is_BasicValue(node)) {
    return primitive_to_string(node);
  }
  if (node === undefined) {
    console.error('undefined caught');
    return "[ERROR UNDEFINED in node to xml]"
  }

  /* handle the various VSNs */
  const { tag, content = [], _meta = BLANK_META } = node;

  switch (tag) {
    case ELEM_TAG: { /* flatten _elem; process children directly */
      $log('list tag found; flattening')
      return content.map(child => serialize_xml(child)).join('\n');
    }
    /* the other special case is strings, which is our default assumption for html 
          strings don't need to be tagged because their type is automatically 
          assigned if no wrapper VSN (_prim, e.g.) is found 

          Primitives need to retain their types; wrap in _prim as a flag. this _prim VSN
          will be visible in the html, unlike _str
        */
    case STRING_TAG: {
      $log('string tag found; flattening')
      if (typeof content[0] !== 'string') {
        console.error('need a primitive in a txt node!')
      }
      return primitive_to_string(content[0] as BasicValue)

    }
  }

  /* handle standard tags or non-exceptional VSNs* 
      (*ie, _obj is serialized into HTML as-is; the only special treatment it 
      gets is its contents are not  wrapped in _elem if an _obj is found*/

  let openLine = `<${tag}`;
  $log(`open TAG: ${tag}`);
  /* get attributes from _meta.attrs */
  for (const [key, value] of Object.entries(_meta.attrs ?? {})) {

    /*  --- 'if' block type guard --- */
    if (key === 'style' && typeof value === 'object' && value !== null) {
      /* special attrs handling for <style> - use parse_css_string()
          for now, style is the only attribute that is parsed; if we want to extend that 
          perhaps we could create a _parse="" attr that forces parsing of its attribute content 
                        (no that wouldn't do what I want) */
      /* serialize the style object back into a CSS string */
      const styleString = serialize_css(value as Record<string, string>);

      /* append completed style attribute to the WIP tag string */
      openLine += ` style="${escape_html(styleString)}"`;

    } else {

      if (value !== undefined) {
        /* ensure value is stringified *before* escaping */
        const trimmedStr: string = (typeof value === 'string') ? value : String(value);
        openLine += ` ${key}="${escape_html(trimmedStr)}"`;
      }
    }
  }

  /* add flags from _meta.flags */
  for (const flag of _meta.flags ?? []) {
    if (typeof flag === 'string') {
      openLine += ` ${flag}`;
    } else if (typeof flag === 'object' && flag !== null) {
      const [[key, value]] = Object.entries(flag);
      if (key === String(value)) {
        /* it's a flag */
        openLine += ` ${key}`;
      } else {
        /* it's an attribute */
        if (value !== null && value !== undefined) {
          const val = typeof value === 'string' ? value : String(value);
          openLine += ` ${key}="${escape_html(val)}"`;
        }
      }
    }
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
 * @throws Error if input node is null or undefined, or if intermediate XML is empty/invalid.
 */


export function serialize_html($node: HsonNode | BasicValue): string {
  if ($node === undefined) {
    throw new Error('input node cannot be undefined for node_to_html');
  }
  if (_VERBOSE) {
    console.groupCollapsed('---> serializing to html')
    console.log('input node: ')
    console.log(make_string($node))
    console.groupEnd();
  }
  const xmlString = serialize_xml($node);

  /*  KEY OPERATION: flag trimmer
          transform `key="key"` -> `key` for html boolean attributes
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