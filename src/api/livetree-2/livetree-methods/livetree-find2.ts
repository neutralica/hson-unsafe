import { HsonQuery, Primitive } from "../../../types-consts";
import { parse_selector } from "../../../utils/tree-utils/parse-selector.utils";
import { LiveTree2 } from "../livetree2";
import { FindWithById2 } from "../livetree2.types";
import { makeTreeSelector, TreeSelector } from "../tree-selector";
import { applyAttrToNode, readAttrFromNode } from "./attrs-manager";
import { search_nodes } from "./node-search2";


export function setAttrsImpl(
    tree: LiveTree2,
    nameOrMap: string | Record<string, string | boolean | null>,
    value?: string | boolean | null,
): LiveTree2 {
    const node = tree.node; // mutators are allowed to throw if unbound

    if (typeof nameOrMap === "string") {
        applyAttrToNode(node, nameOrMap, (value as string | boolean | null) ?? null);
        return tree;
    }

    for (const [k, v] of Object.entries(nameOrMap)) {
        applyAttrToNode(node, k, (v as string | boolean | null) ?? null);
    }
    return tree;
}

export function removeAttrImpl(tree: LiveTree2, name: string): LiveTree2 {
    const node = tree.node;
    applyAttrToNode(node, name, null);
    return tree;
}

export function setFlagsImpl(tree: LiveTree2, ...names: string[]): LiveTree2 {
    const node = tree.node;
    for (const n of names) {
        applyAttrToNode(node, n, true);
    }
    return tree;
}
export function getAttrImpl(tree: LiveTree2, name: string): Primitive | undefined {
    return readAttrFromNode(tree.node, name);
}
export function makeFindFor(tree: LiveTree2): FindWithById2 {
    const base = ((q: HsonQuery | string): LiveTree2 | undefined => {
        const query = typeof q === "string" ? parse_selector(q) : q;

        // LiveTree2 is single-root now → wrap in array for the search utility
        const found = search_nodes([tree.node], query, { findFirst: true });

        if (!found.length) return undefined;
        return new LiveTree2(found[0]);
    }) as FindWithById2;

    base.byId = (id: string): LiveTree2 | undefined =>
        base({ attrs: { id } });

    base.must = (q: HsonQuery | string, label?: string): LiveTree2 => {
        const res = base(q);
        if (!res) {
            const desc = label ?? (typeof q === "string" ? q : JSON.stringify(q));
            throw new Error(`[LiveTree2.find.must] expected match for ${desc}`);
        }
        return res;
    };

    base.mustById = (id: string, label?: string): LiveTree2 => {
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

    const trees = found.map(node => new LiveTree2(node));
    return makeTreeSelector(trees);
}