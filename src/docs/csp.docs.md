Content Security Policy (CSP)
HSON is designed to operate safely under a strict Content Security Policy.
We recommend adding a CSP header such as:

default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'self';

How to set this depends on your host:
Cloudflare / Netlify: add a _headers file
Vercel: add vercel.json headers
Express: use the helmet package
Other servers: use Content-Security-Policy response headers