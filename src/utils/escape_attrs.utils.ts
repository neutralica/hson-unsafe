// escape_attrs.utils.hson.ts

export function escape_attrs(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

