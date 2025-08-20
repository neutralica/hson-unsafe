// serialize-css.utils.hson.ts

/**
 * converts a camelCase string to kebab-case
 * @param {string} $str "backgroundColor"
 * @returns {string} "background-color"
 */
export function camel_to_kebab($str: string): string {
  // find all uppercase letters; replace them with a hyphen and their lowercase version
  return $str.replace(/[_\s]+/g, "-")               // underscores/spaces → hyphen
    .replace(/[_\s]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/-+/g, "-")
    .toLowerCase();
}


/**
 * takes a style object and converts it back into a CSS string
 * @param $style - a Dictionary-like object of CSS properties
 * @returns {string} a browser-compatible CSS string
 */
export function serialize_css($style: Record<string, string>): string {
  let cssText = "";

  /* get keys, sort alphabetically before iterating (for node consistency) */
  const sortedKeys = Object.keys($style).sort();

  for (const property of sortedKeys) {
    if (Object.prototype.hasOwnProperty.call($style, property)) {
      const value = $style[property];
      cssText += `${camel_to_kebab(property)}: ${value}; `;
    }
  }

  return cssText.trim();
}