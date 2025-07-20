// semi-sanitize-html.utils.hson.ts

import { normalize_html } from "./normalize-html.utils.hson.js";

/**
 * (!!temporary placeholder sanitizer for development and testing!!)
 * 
 *  THIS IS NOT SECURE and should be replaced with a robust library
 *
 * TODO: use DOMPurify before handling any untrusted data
 */
export function sanitize_html($htmlString: string): string {
    console.warn(
      'WARNING: using placeholder html sanitizer\n ** DO NOT use this library with untrusted data**'
    );
  
    let sanitized = $htmlString;
  
    /* remove script tags and their content */
    sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  
    /* remove all "on..." event handler attributes (e.g., onclick, onerror) */
    sanitized = sanitized.replace(/\s(on\w+)=(".*?"|'.*?'|[^ >]+)/gi, '');
  
    /* remove javascript: from href attributes */
    sanitized = sanitized.replace(/href="javascript:/gi, 'href="');
  
    /*  pass to normalizer for structural cleanup */
    return normalize_html(sanitized);
  }