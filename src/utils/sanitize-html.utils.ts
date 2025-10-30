// sanitize-html.util.ts

import  DOMPurify from "dompurify";
import { _ERROR, _FALSE, ARR_TAG, ELEM_OBJ, ELEM_TAG, II_TAG, OBJ_TAG, VAL_TAG, ROOT_TAG, STR_TAG } from "../types-consts/constants";
import { ALLOWED_ATTR, ALLOWED_TAGS, ALLOWED_URI_REGEX } from "../safety/safe-mount.safe";

/**
 * sanitizes html strings to prevent potential cross-site scripting (XSS) attacks
 *
 * @param $input - the HTML content to process
 * @param options - configuration for this step
 * @param options.sanitize - set to false to disable HTML sanitization
 * @returns - the next step in the processing chain
 */

// Return type is explicit; no `as`
export function sanitize_html(input: string): string {
  // Mutable copies to satisfy DOMPurify typings
  const clean: string = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    FORBID_TAGS: ["script","style","iframe","object","embed","link","meta","base","form","input","video","audio"],
    FORBID_ATTR: ["style","onerror","onclick","onload","onmouseover","on*", "srcdoc"],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: false,
    ALLOWED_URI_REGEXP: ALLOWED_URI_REGEX
  });
  return clean;
}