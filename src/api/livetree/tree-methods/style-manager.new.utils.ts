// style-manager.utils.ts


import { NODE_ELEMENT_MAP } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.new.types";
import { LiveTree } from "../live-tree-class.new.tree";

/**
 * expedites & eases the frequent interactions with the style property
 * allowing for fine-grained additive/subtractive editing property-by-property
 * without the need to pass whole style="" strings every time
 * 
 */

export default class StyleManager_NEW {
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
        // normalize prop: backgroundColor → background-color
        const name = propertyName.includes('-')
            ? propertyName
            : propertyName.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

        // safest: act on the first element in the current selection
        const el = this.liveTree.asDomElement();
        if (!el) return this.liveTree;

        if (value === null) el.style.removeProperty(name);
        else el.style.setProperty(name, value);

        return this.liveTree; // keep chaining: tree.style.set(...).style.set(...)
    }

    /**
     * Gets a style property from the first selected node.
     * @param propertyName The CSS property name.
     * @returns The style value, or undefined if not found.
     */
    get(propertyName: string): string | undefined {
        const node = this.liveTree.sourceNode() as HsonNode;
        if (!node) return undefined;

        const styleObj = node._attrs?.style;
        if (typeof styleObj === 'object' && styleObj !== null) {
            const camelCaseProperty = propertyName.replace(/-(\w)/g, (_, c) => c.toUpperCase());
            return (styleObj as Record<string, string>)[camelCaseProperty];
        }
        return undefined;
    }
}
