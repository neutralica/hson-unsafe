// src/security/url.ts
export function screen_url(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return false;

  // ftp/mailto/tel allowed if you want them; keep it narrow by default
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
