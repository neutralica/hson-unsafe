// parse-css.utils.hson.ts

import { _throw_transform_err } from "./throw-transform-err.utils.hson";

/* debug log */
let _VERBOSE = true;
const STYLE = 'color:grey;font-weight:600;padding:1px 3px;border-radius:4px';
// tweak _log to style every arg (incl. your prefix), no helpers:
const _log = _VERBOSE
  ? (...args: unknown[]) =>
    console.log(
      ['%c%s', ...args.map(() => '%c%o')].join(' '),
      STYLE, '[parse_style] →',
      ...args.flatMap(a => [STYLE, a]),
    )
  : () => { };


/**
 * Parses a CSS style string into a camelCased JavaScript object.
 * @param {string} $text - e.g., "color: blue; font-weight: bold;"
 * @returns {Record<string, string>} - e.g., { color: 'blue', fontWeight: 'bold' }
 */
export function parse_style($text: string): string | Record<string, string> {
  try {
    if (!$text) {
      console.warn('no text received');
      return {};
    }

    const styleObject: Record<string, string> = {};

    /* 1. split the string into individual "key: value" declarations */
    const declarations = $text.split(';');

    for (const declaration of declarations) {
      /* skip empty parts from trim */
      if (!declaration.trim()) {
        continue;
      }

      /* 2. get key, value */
      const [property, ...valueParts] = declaration.split(':');
      const value = valueParts.join(':').trim();

      if (property && value) {
        const propTrimmed = property.trim();

        /* kebab-case to camelCase conversion */
        const camelCaseProp = propTrimmed.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());

        styleObject[camelCaseProp] = value;
      }
    }

    const sortStyleObj: Record<string, string> = {};
    Object.keys(styleObject)
      .sort()
      .forEach(key => {
        sortStyleObj[key] = styleObject[key];
      });

    return sortStyleObj;
  } catch (e) {
    _throw_transform_err('[HSON WARN parse-css.util.hson.ts -- error parsing CSS style string] ', 'parse_css_attrs', $text);
  }
}