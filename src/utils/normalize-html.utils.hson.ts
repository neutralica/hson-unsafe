// sanitize-html.util.hson.ts

import { _CORE } from "../types-consts/constants.types.hson.js";

/**
 * sanitizes html strings to prevent potential cross-site scripting (XSS) attacks
 *
 * @param $input - the HTML content to process
 * @param options - configuration for this step
 * @param options.sanitize - set to false to disable HTML sanitization
 * @returns - the next step in the processing chain
 */

export function normalize_html($input: string | Element): string {
   /* 1) wrap in root so unbalanced tags get closed */
   const wrapped = `<${_CORE}>${$input}</${_CORE}>`;
   console.log(wrapped);
   /* 2) parse as HTML */
   const doc = new DOMParser().parseFromString(wrapped, 'application/xml');
   console.log(doc);
   const dataCore = doc.documentElement;
   console.log(dataCore)
   if (!dataCore) {
      console.log(_CORE)
      console.error('no _CORE');
      return '[ERROR: NO _CORE!!]';
   }

   /* 3) serialize back to XML (self-closing where possible, proper nesting)
      XMLSerializer will auto-close tags and quote attributes */
   const xml = new XMLSerializer().serializeToString(dataCore);

   /* 4) strip off artificial <root> wrapper */
     return xml
   .replace(new RegExp(`^<${_CORE}>`), '')
   .replace(new RegExp(`</${_CORE}>$`), ''); 
}
