// sanitize-html.util.hson.ts

import  DOMPurify from "dompurify"

/**
 * sanitizes html strings to prevent potential cross-site scripting (XSS) attacks
 *
 * @param $input - the HTML content to process
 * @param options - configuration for this step
 * @param options.sanitize - set to false to disable HTML sanitization
 * @returns - the next step in the processing chain
 */

export function sanitize_html($input: string | Element): string {
   /* 1) wrap in root so unbalanced tags get closed */
  
   return DOMPurify.sanitize($input);
}
