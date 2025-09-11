// kebab-to-camel.util.ts

export function kebab_to_camel(s: string): string {
  if (!s) return s;

  // collapse runs of dashes
  let x = s.replace(/-+/g, "-");

  // vendor prefix at start
  if (x.startsWith("-")) {
    const rest = x.slice(1);
    if (rest.startsWith("ms-")) {
      x = "ms-" + rest.slice(3);
    } else if (rest.length) {
      x = rest[0].toUpperCase() + rest.slice(1);
    } else {
      x = ""; // just "-"
    }
  }

  // turn -a into A
  return x.replace(/-([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
}

/* examples:
kebab_to_camel("border-radius")      // "borderRadius"
kebab_to_camel("-webkit-transform")  // "WebkitTransform"
kebab_to_camel("-ms-transition")     // "msTransition"
kebab_to_camel("font-size")          // "fontSize"
kebab_to_camel("color")              // "color"
*/