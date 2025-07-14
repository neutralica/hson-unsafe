// escape-html.hson.util.ts

import { is_BasicValue } from "./is-helpers.utils.hson.js";

/* basic escape helper to be used pre-serialization of HTML */
export function escape_html(str: any): string {
  if (!is_BasicValue(str)) {
    throw new Error('need a string in escape_html')
  }
  if (typeof str !== 'string') {
    return String(str);
  } else {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
