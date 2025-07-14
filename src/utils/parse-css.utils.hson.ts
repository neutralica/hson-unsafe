// parse-css.utils.hson.ts

/**
 * Parses a CSS style string into a camelCased JavaScript object.
 * @param {string} $text - e.g., "color: blue; font-weight: bold;"
 * @returns {Record<string, string>} - e.g., { color: 'blue', fontWeight: 'bold' }
 */
export function parse_css_attrs($text: string): string | Record<string, string> {
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
    console.warn('[HSON WARN parse-css.util.hson.ts -- error parsing CSS style string] ');
    return $text;
  }
}