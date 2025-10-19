// style-manager.utils.ts


import { NODE_ELEMENT_MAP } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.new.types";
import { make_string } from "../../../utils/make-string.utils";
import { camel_to_kebab } from "../../../utils/serialize-css.utils";
import { LiveTree } from "../live-tree-class.new.tree";

/**
 * expedites & eases the frequent interactions with the style property
 * allowing for fine-grained additive/subtractive editing property-by-property
 * without the need to pass whole style="" strings every time
 * 
 */

export default class StyleManager {
  constructor(private liveTree: LiveTree) {}

  set(propertyName: string, value: string | number | null): LiveTree {
    const prop = camel_to_kebab(propertyName);
    const val  = value == null ? '' : String(value);

    const nodes: HsonNode[] = this.liveTree.getSelectedNodes(); // <- getter
    for (const node of nodes) {
      // 1) push to DOM
        const el = NODE_ELEMENT_MAP.get(node);
        if (el) {
        // setProperty handles kebab properly and avoids clobbering shorthands
        (el as HTMLElement).style.setProperty(prop, val);
      }

      // 2) mirror into node attrs for serialization
      const a = (node._attrs ??= {});
      // support string or object style; prefer object going forward
      if (typeof a.style === 'string') {
        // convert existing string to object once
        const prev = a.style.trim();
        const obj: Record<string, string> = {};
        if (prev) {
          prev.split(';').forEach(rule => {
            const [k, v] = rule.split(':');
            if (k && v) obj[k.trim()] = v.trim();
          });
        }
        a.style = obj;
      }
      const s = (a.style ??= {}) as Record<string, string>;
      if (val === '') {
        delete s[prop];
      } else {
        s[prop] = val;
      }
    }

    return this.liveTree; // enables: tree.style.set(...).style.set(...)
  }

  get(propertyName: string): string | undefined {
    const prop = camel_to_kebab(propertyName);
    const node = this.liveTree.getSelectedNodes()[0];
    if (!node) return;
    const el = NODE_ELEMENT_MAP.get(node);
    if (el) {
      const v = getComputedStyle(el as HTMLElement).getPropertyValue(prop);
      return v || undefined;
    }
    const a = node._attrs;
    if (!a) return;
    if (typeof a.style === 'string') {
      const m = a.style.match(new RegExp(`(^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
      return m?.[2]?.trim();
    } else if (a.style && typeof a.style === 'object') {
      return (a.style as Record<string, string>)[prop];
    }
  }

  remove(propertyName: string): LiveTree {
    return this.set(propertyName, null);
  }
}