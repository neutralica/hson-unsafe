// style-manager.utils.hson.ts

import { NODE_ELEMENT_MAP_NEW } from "../../../new/types-consts/constants.new.hson";
import { HsonNode_NEW } from "../../../new/types-consts/node.new.types.hson";
import { LiveTree_NEW } from "../live-tree-class.new.tree.hson";

/**
 * expedites & eases the frequent interactions with the style property
 * allowing for fine-grained additive/subtractive editing property-by-property
 * without the need to pass whole style="" strings every time
 * 
 */

export default class StyleManager_NEW {
    private liveTree: LiveTree_NEW;

    constructor(liveTree: LiveTree_NEW) {
        this.liveTree = liveTree;
    }

    /**
     * sets a CSS style property on all selected nodes
     * @param propertyName the CSS property (e.g., 'backgroundColor' or 'background-color')
     * @param value the new value 
     */
    set(propertyName: string, value: string | null): LiveTree_NEW {
        const nodes = this.liveTree.sourceNode() as HsonNode_NEW[];
        for (const node of nodes) {
            if (!node._attrs) continue;

            /*  ensure the style attribute is an object */
            if (typeof node._attrs.style !== 'object' || node._attrs.style === null) {
                node._attrs.style = {};
            }

            // /* Convert propertyName to camelCase for the object key */
            const camelCaseProperty = propertyName.replace(/-(\w)/g, (_, c) => c.toUpperCase());
            
            const styleObj = node._attrs.style as Record<string, string>;

            if (value === null) {
                delete styleObj[camelCaseProperty];
            } else {
                styleObj[camelCaseProperty] = value;
            }

            // Sync with the live DOM element
            const liveElement = NODE_ELEMENT_MAP_NEW.get(node);
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
        const node = this.liveTree.sourceNode() as HsonNode_NEW;
        if (!node) return undefined;

        const styleObj = node._attrs?.style;
        if (typeof styleObj === 'object' && styleObj !== null) {
            const camelCaseProperty = propertyName.replace(/-(\w)/g, (_, c) => c.toUpperCase());
            return (styleObj as Record<string, string>)[camelCaseProperty];
        }
        return undefined;
    }
}
