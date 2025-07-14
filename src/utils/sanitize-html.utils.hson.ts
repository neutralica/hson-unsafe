// sanitize-html.util.hson.ts

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
   const wrapped = `<root>${$input}</root>`;

   /* 2) parse as HTML (forgiving) */
   const doc = new DOMParser().parseFromString(wrapped, 'text/html');

   /* 3) serialize back to XML (self-closing where possible, proper nesting)
      XMLSerializer will auto-close tags and quote attributes */
   const xml = new XMLSerializer().serializeToString(doc.documentElement);

   /* 4) strip off artificial <root> wrapper */
   return xml
      .replace(/^<root>/, '')
      .replace(/<\/root>$/, '');
}
