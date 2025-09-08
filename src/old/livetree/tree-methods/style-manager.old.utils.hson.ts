// style-manager.utils.hson.ts

import { LiveTree } from "../live-tree-class.old.tree.hson.js";
import { NODE_ELEMENT_MAP } from "../../types/node-constants.old.js";
import { HsonNode } from "../../../types-consts/node.types.hson.js";

/**
 * expedites & eases the frequent interactions with the style property
 * allowing for fine-grained additive/subtractive editing property-by-property
 * without the need to pass whole style="" strings every time
 * 
 */

export default class StyleManager {
    private liveTree: LiveTree;

    constructor(liveTree: LiveTree) {
        this.liveTree = liveTree;
    }

    /**
     * sets a CSS style property on all selected nodes
     * @param propertyName the CSS property (e.g., 'backgroundColor' or 'background-color')
     * @param value the new value 
     */
    set(propertyName: string, value: string | null): LiveTree {
        const nodes = this.liveTree.sourceNode() as HsonNode[];
        for (const node of nodes) {
            if (!node._meta?.attrs) continue;

            /*  ensure the style attribute is an object */
            if (typeof node._meta.attrs.style !== 'object' || node._meta.attrs.style === null) {
                node._meta.attrs.style = {};
            }

            // /* Convert propertyName to camelCase for the object key */
            const camelCaseProperty = propertyName.replace(/-(\w)/g, (_, c) => c.toUpperCase());
            
            const styleObj = node._meta.attrs.style as Record<string, string>;

            if (value === null) {
                delete styleObj[camelCaseProperty];
            } else {
                styleObj[camelCaseProperty] = value;
            }

            // Sync with the live DOM element
            const liveElement = NODE_ELEMENT_MAP.get(node);
            if (liveElement) {
                // It's easier to just re-apply the whole style string
                liveElement.style.cssText = Object.entries(styleObj)
                    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}: ${v}`)
                    .join('; ');
            }
        }
        return this.liveTree;
    }

    /**
     * Gets a style property from the first selected node.
     * @param propertyName The CSS property name.
     * @returns The style value, or undefined if not found.
     */
    get(propertyName: string): string | undefined {
        const node = this.liveTree.sourceNode() as HsonNode;
        if (!node) return undefined;

        const styleObj = node._meta?.attrs?.style;
        if (typeof styleObj === 'object' && styleObj !== null) {
            const camelCaseProperty = propertyName.replace(/-(\w)/g, (_, c) => c.toUpperCase());
            return (styleObj as Record<string, string>)[camelCaseProperty];
        }
        return undefined;
    }
}
