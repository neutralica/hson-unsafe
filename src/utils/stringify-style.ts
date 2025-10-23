// // NEW: stringify style object to stable CSS (kebab keys, sorted)

// export function stringify_style(obj: Record<string, string>): string {
//   const toKebab = (k: string) => k.replace(/[_\s]+/g, "-")
//     .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
//     .replace(/-+/g, "-")
//     .toLowerCase();

//   const entries = Object.keys(obj)
//     .map(k => [toKebab(k), obj[k]] as const)
//     .sort((a, b) => a[0].localeCompare(b[0]));

//   return entries.map(([k, v]) => `${k}:${v}`).join("; ");
// }
