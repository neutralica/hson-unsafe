import { _TRANSIT_ATTRS, _TRANSIT_PREFIX } from "../../types-consts/constants";

// XML 1.0 Name production (approx; good enough for preflight)
const XML_NAME = /^[A-Za-z_:\u00C0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][\w.\-:\u00B7\u0300-\u036F\u203F-\u2040]*$/u;

// Turn any non-ASCII or disallowed chars into _xHHHH_ sequences (ASCII-safe)
function xHHHdisallowed(name: string): string {
  let ok = true;
  if (!XML_NAME.test(name)) ok = false;
  if (ok) return name;
  let out = "_attr";
  for (let i = 0; i < name.length; i++) {
    const cp = name.codePointAt(i)!;
    const ch = name[i];
    if (/^[A-Za-z0-9._:\-]$/.test(ch)) { out += ch; }
    else { out += `_x${cp.toString(16)}_`; if (cp > 0xffff) i++; }
  }
  return out;
}

export function disallow_illegal_attrs(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { out += src.slice(i); break; }
    const gt = src.indexOf(">", lt + 1);
    if (gt < 0) { out += src.slice(i); break; }

    out += src.slice(i, lt);
    const tag = src.slice(lt, gt + 1);

    // Skip comments/doctype/processing
    if (/^<\/|^<!|^<\?/.test(tag.slice(1))) { out += tag; i = gt + 1; continue; }

    const attrMap: Record<string, string> = {};

    const rewritten = tag.replace(
      // name[=value]? capturing name, value separately (value already quoted by previous step)
      /(<[^\s\/>]+)|(\s+)([^\s"'=\/><]+)(\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')))?/g,
      (m, openTag, space, name, eqval) => {
        if (openTag) return openTag; // element name untouched here
        const safe = xHHHdisallowed(name);
        if (safe !== name) attrMap[safe] = name;
        return `${space}${safe}${eqval ?? ""}`;
      }
    );

    if (Object.keys(attrMap).length > 0) {
      // append a per-element mapping attribute (ASCII-safe JSON)
      const mapJson = JSON.stringify(attrMap)
        .replace(/</g, "\\u003C") // avoid accidental tag starts
        .replace(/>/g, "\\u003E");
      const withMap = rewritten.replace(/>$/, ` ${_TRANSIT_ATTRS}='${mapJson}'>`);
      out += withMap;
    } else {
      out += rewritten;
    }

    i = gt + 1;
  }
  return out;
}
