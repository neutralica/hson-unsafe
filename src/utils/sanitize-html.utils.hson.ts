// sanitize-html.util.hson.ts

import DOMPurify from "dompurify"
import { _ERROR, _FALSE, ARRAY_TAG, ELEM_OBJ, ELEM_TAG, INDEX_TAG, OBJECT_TAG, PRIM_TAG, ROOT_TAG, STRING_TAG } from "../types-consts/constants.types.hson";

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

   return DOMPurify.sanitize($input, {
      // 1. Tell DOMPurify to use the XML parser, not the HTML one.
      PARSER_MEDIA_TYPE: 'application/xml',

      // 2. Provide a list of all your custom tags to add to the "allow list".
      ADD_TAGS: [ROOT_TAG, ELEM_TAG,
         OBJECT_TAG, ARRAY_TAG,
         INDEX_TAG, _FALSE, _ERROR,
         PRIM_TAG, STRING_TAG, ROOT_TAG]
   });
}
