// serialize-css.utils.hson.ts

/**
 * converts a camelCase string to kebab-case
 * @param {string} $str "backgroundColor"
 * @returns {string} "background-color"
 */
function camelToKebab($str: string): string {
    // find all uppercase letters; replace them with a hyphen and their lowercase version
    return $str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
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
          cssText += `${camelToKebab(property)}: ${value}; `;
        }
      }
      
      return cssText.trim();
    }