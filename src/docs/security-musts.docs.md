To ship this safely:

 Treat HSON like a tiny CMS engine and put a hard gate in front of any DOM it generates. Here’s the minimal, practical plan—concrete, dependency-light, and production-grade.

0) Decide where untrusted content can enter
Trusted: build-time HSON bundled with the site.
Untrusted: anything loaded after build (DB/CMS, uploads, fetch(), third-party).
Only the untrusted path goes through the sanitizer + sandbox below. Keep the code path explicit.

1) One render gate for untrusted HSON → DOM
Parse off-document (create a DocumentFragment or an inert container).
Sanitize the entire subtree (allow-list).
Adopt into the live DOM only if sanitized.
Implementation shape (TypeScript SOP, no frameworks):
parseHsonToFragment(input: string): DocumentFragment
sanitizeFragment(fragment: DocumentFragment): DocumentFragment
mount(fragment, into: Element): void
Never call innerHTML on untrusted strings. If you must, only through a Trusted-Types policy (see §4).

2) Strict allow-list sanitizer (tiny and sufficient)
Either use DOMPurify in strict mode or write a focused allow-list. For a first deploy, a lean in-house allow-list is fine:
Tags (allow): div, p, span, strong, em, ul, ol, li, img, a, h1–h6, br, hr
Attrs (allow): class, id, title, alt, src, srcset, sizes, href, target, rel, aria-*, role, data-*
Always strip: on* handlers, style, formaction, ping, srcdoc, integrity, nonce, autofocus.
Ban tags outright: script, style, iframe, object, embed, link, meta, base, form, input, video, audio (add individual cases later with specific rules).
SVG: initially ban. Later, allow svg,g,path,rect,circle with no external refs (xlink:href, href) and no animation/foreignObject.
URL protocols (allow): https:, http:, mailto:, tel:.
URL protocols (deny): javascript:, vbscript:, data: (except data:image/* if you intentionally support inline images).
Rel hygiene: if a[target=_blank], force rel="noopener noreferrer".
Size/time guards: reject fragments > ~5k elements or > ~100 KB text total; abort sanitize after a reasonable operation count to avoid “beautiful DoS”.

3) Inert parse → sanitize → adopt (no partial attaches)
Create a detached root: document.createDocumentFragment() (or a <template> element).
Build nodes with createElement APIs; if you must parse HTML, put it in a detached container, sanitize there, then move children out.
Only append to the live DOM after the full subtree passes sanitation.

4) Content Security Policy (CSP) + (optional) Trusted Types
Set a tight CSP that matches your runtime:
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'self';
If you can move inline styles to CSS, drop 'unsafe-inline' from style-src.
When ready, add Trusted Types to force all DOM-creation through your gate:
require-trusted-types-for 'script';
trusted-types hson;
Implement a single TT policy (e.g., window.trustedTypes.createPolicy('hson', { createHTML: ... })) that only accepts strings from your sanitizer.
5) Network discipline for fetched HSON
Same-origin only for HSON fetches (/content/...), HTTPS required.
Versioned paths or hashes for server responses (e.g., /content/abc123.hson).
If you serve static HSON, add Cache-Control: max-age=31536000, immutable to hashed files; otherwise short TTLs.
No third-party HSON without a sandboxed iframe (see §8).
6) Forms, cookies, and navigation safety
If you ever permit <a target=_blank>, enforce rel="noopener noreferrer" in the sanitizer.
Don’t allow <base> or <meta http-equiv="refresh">; strip them at the gate.
Keep auth/session cookies HttpOnly; Secure; SameSite=Lax|Strict so even if a mistake slips, document.cookie is empty or limited.
7) Error visibility without leaking data
Wrap sanitize+mount in try/catch.
Dev build: render a tiny overlay with a short error code and the offending node name; no string echo of attacker content.
Prod: fail closed (don’t mount) and log a structured error to your server with redaction.
8) Editor/preview isolation (when you add live editing)
Put WYSIWYG or user-editable previews in a sandboxed iframe:
sandbox="allow-scripts allow-same-origin" (omit allow-top-navigation, omit allow-popups initially).
Pass only sanitized HTML across postMessage. Parent never touches raw user strings.
The rest of the site remains on the parent origin with the tight CSP.
9) Tests you actually run (tiny corpus, big payoff)
Automate a dozen regression cases and run them on every change:
<img src=javascript:alert(1)> → removed/neutralized.
<a href="javascript:..."> → href stripped.
<svg onload=...> → tag stripped.
<a target=_blank> → gets rel="noopener noreferrer".
<base href="//evil"> → stripped.
<meta http-equiv=refresh content=0;url=//evil> → stripped.
style="background:url(javascript:...)" → style stripped.
srcdoc="<script>..." → attr stripped.
Oversized fragment → rejected gracefully.
10) Perf keep-alive for your visuals
Keep your fog/cloud animations on transform/opacity only.
Don’t animate filter: blur() on giant layers.
Add @media (prefers-reduced-motion: reduce){ animation: none; }.
Use contain: paint and will-change: transform on moving layers sparingly (only on the clouds).
11) Operational hygiene
HTTPS only (HSTS: max-age=15552000; includeSubDomains).
Subresource Integrity on third-party scripts (if you ever add any).
Service Worker (if used): versioned caches, skip-waiting + clients-claim on deploy to avoid stale sanitizer/runtime.
Minimal “rest-easy” deployment profile
All untrusted HSON goes through one sanitizer with the allow-lists above.
CSP set as shown; later, add Trusted Types and route innerHTML through a single policy.
Inert parse → sanitize → adopt; never partially attach.
If live editing/preview exists, it lives in a sandboxed iframe with message-passing.
Add the tiny regression corpus to CI; block deploy on sanitizer regressions.
This is the boring, reliable setup you want. It doesn’t fight your “interactive HSON” goals, and it scales from “static flower site” to “user-editable pages” without changing the fundamentals.