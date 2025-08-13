// escape-html.hson.util.ts

import { is_Primitive } from "../core/utils/guards.core.utils.hson.js";
import { _throw_transform_err } from "./throw-transform-err.utils.hson.js";

/* basic escape helper to be used pre-serialization of HTML */
export function escape_html($str: any): string {
  if (!is_Primitive($str)) {
    _throw_transform_err('need a string in escape_html', 'escape_html', $str)
  }
  if (typeof $str !== 'string') {
    return String($str);
  } else {
    return $str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
