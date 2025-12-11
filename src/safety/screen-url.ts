// screen-url.ts

/***************************************************************
 * screen_url
 *
 * Conservative URL filter for security-sensitive attributes
 * (e.g. href, src) that enforces:
 *   - an explicit, non-empty value,
 *   - a whitelisted protocol,
 *   - and strict rules for data: URLs.
 *
 * Allowed protocols:
 *   - "https:"
 *   - "http:"
 *   - "data:"    (images only, base64-encoded)
 *   - "blob:"
 *
 * Behavior:
 *   1. Trim the input string; reject if empty.
 *   2. Construct a `URL` using `location.origin` as base,
 *      so relative paths become absolute for inspection.
 *   3. Reject if the derived `u.protocol` is not in the
 *      `allowedSchemes` list.
 *   4. For `data:`:
 *        - require `data:image/<type>;base64,...` form,
 *          reject all other data: payloads
 *          (e.g. `data:text/html`).
 *   5. On any parsing error, return false.
 *
 * Security notes:
 *   - Protocol-relative URLs (`//cdn.example.com/...`) are
 *     rejected (treated as “no explicit scheme”).
 *   - `ftp:`, `mailto:`, `tel:`, and other schemes are not
 *     allowed by default; add them to `allowedSchemes`
 *     explicitly if ever needed.
 *
 * Typical usage:
 *   - As a guard before writing `href` / `src` into the DOM:
 *
 *       if (screen_url(url)) {
 *         el.setAttribute("href", url);
 *       }
 *
 * @param value  Raw URL string from user or external source.
 * @returns      true if the URL passes scheme and data: checks;
 *               false otherwise.
 ***************************************************************/
export function screen_url(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return false;

  // ftp/mailto/tel allowed but keep it narrow by default
  const allowedSchemes = ["https:", "http:", "data:", "blob:"];
  try {
    const u = new URL(v, location.origin);
    if (!allowedSchemes.includes(u.protocol)) return false;
    if (u.protocol === "data:") {
      // only allow images; block data:text/html etc.
      return /^data:image\/[a-z0-9.+-]+;base64,/i.test(v);
    }
    return true;
  } catch {
    // protocol-relative //cdn.example/... counts as unsafe; force explicit scheme
    return false;
  }
}
