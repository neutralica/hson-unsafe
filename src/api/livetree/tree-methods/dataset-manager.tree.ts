// src/utils/style-manager.utils.ts

import { Primitive } from "../../../types-consts";
import { LiveTree } from "../live-tree-class.new.tree";



/**
 * DatasetManager
 * --------------
 * A lightweight helper for manipulating `data-*` attributes on all nodes
 * currently selected in a LiveTree.
 *
 * This is conceptually similar to `HTMLElement.dataset`, but with two key
 * differences:
 *
 *   1. It operates on *HSON nodes*, not DOM elements alone.
 *      (When nodes are mounted, DOM attributes are also synced.)
 *
 *   2. Keys are provided in logical form (e.g. `"userId"`), and the manager
 *      automatically normalizes to real HTML attribute names
 *      (`data-user-id`).
 *
 * Usage:
 *   tree.dataset.set("userId", "42");
 *   const user = tree.dataset.get("userId");
 *
 * Behavior notes:
 *   - `null` removes the attribute.
 *   - Reads (`get`) reflect the first selected node.
 *   - No attempt is made to coerce to/from numbers; everything is stored
 *     as strings, matching real HTML.
 */
export class DatasetManager {
    private liveTree: LiveTree;

    /**
     * Creates a DatasetManager for a specific LiveTree.
     *
     * @param liveTree - The LiveTree whose current selection determines
     *   which nodes receive data-attribute updates.
     */
    constructor(liveTree: LiveTree) {
        this.liveTree = liveTree;
    }

    /**
     * Sets or removes a `data-*` attribute on all selected nodes.
     *
     * @param key - Logical name (e.g. `"userId"`). It will be normalized
     *   to kebab-case and prefixed with `"data-"`, producing
     *   `data-user-id`.
     *
     * @param value - New value. `null` removes the attribute.
     *
     * Behavior:
     *   - Delegates to `LiveTree.setAttrs`, ensuring both IR and DOM remain
     *     in sync.
     *   - Returns the underlying LiveTree to support chaining.
     *
     * Important:
     *   This uses the literal `"data-"` prefix — this is *not* the internal
     *   HSON metadata prefix and should not be renamed.
     */
    set(key: string, value: string | null): LiveTree {
        const dataAttrName = `data-${key}`;
        this.liveTree.setAttrs(dataAttrName, value);
        return this.liveTree;
    }

    /**
     * Reads a `data-*` attribute from the first selected node.
     *
     * @param key - Logical name (e.g. `"userId"`). Normalized to
     *   `data-user-id` before lookup.
     *
     * @returns The stored primitive string value, or `undefined` if the
     *   attribute does not exist or there is no selection.
     *
     * Notes:
     *   - Only inspects the first selected node.
     *   - Delegates to `LiveTree.getAttr`, which reads from the IR (not
     *     computed DOM attributes).
     *
     * Important:
     *   This uses the literal `"data-"` prefix — not the HSON metadata prefix.
     */
    get(key: string): Primitive | undefined {
        const dataAttrName = `data-${key}`;
        return this.liveTree.getAttr(dataAttrName);
    }
}
