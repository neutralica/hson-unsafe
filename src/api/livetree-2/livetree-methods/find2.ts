import { HsonNode, HsonQuery } from "../../../types-consts";
import { parse_selector } from "../../../utils/tree-utils/parse-selector.utils";
import { LiveTree2 } from "../livetree2";
import { FindWithById2 } from "../livetree2.types";
import { makeTreeSelector, TreeSelector } from "../tree-selector";
import { search_nodes } from "./search2";


// helper: wrap a node in a LiveTree2 that inherits the caller's host root
function wrapInChildTree(parent: LiveTree2, node: HsonNode): LiveTree2 {
    return new LiveTree2(node).adoptRoots(parent.getHostRoots());
}

export function makeFindFor(tree: LiveTree2): FindWithById2 {
    const base = ((q: HsonQuery | string): LiveTree2 | undefined => {
        const query = typeof q === "string" ? parse_selector(q) : q;
        const found = search_nodes([tree.node], query, { findFirst: true });
        if (!found.length) return undefined;
        return wrapInChildTree(tree, found[0]); // ← changed
    }) as FindWithById2;

    base.byId = (id: string): LiveTree2 | undefined =>
        base({ attrs: { id } });

    base.must = (q, label) => {
        const res = base(q);
        if (!res) {
            const desc = label ?? (typeof q === "string" ? q : JSON.stringify(q));
            throw new Error(`[LiveTree2.find.must] expected match for ${desc}`);
        }
        return res;
    };

    base.mustById = (id, label) => {
        const res = base.byId(id);
        if (!res) {
            const desc = label ?? `#${id}`;
            throw new Error(`[LiveTree2.find.mustById] expected element ${desc}`);
        }
        return res;
    };

    return base;
}

export function findAllFor(tree: LiveTree2, q: HsonQuery | string): TreeSelector {
    const query = typeof q === "string" ? parse_selector(q) : q;
    const found = search_nodes([tree.node], query, { findFirst: false });

    const trees = found.map(node => wrapInChildTree(tree, node)); // ← changed
    return makeTreeSelector(trees);
}