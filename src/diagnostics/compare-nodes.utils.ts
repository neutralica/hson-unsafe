// compare-nodes.utils.ts
import type { HsonNode } from "../types-consts/node.new.types";
import { is_Node } from "../utils/node-guards.new.utils";
import { make_string } from "../utils/make-string.nodes.utils";

const LEAF = new Set(["_str", "_val"]);
const MAX_SNIP = 500;
const ELLIPSIS = " …";

const snip = (s?: string, n = MAX_SNIP) =>
    !s ? "" : s.length <= n ? s : s.slice(0, n - ELLIPSIS.length) + ELLIPSIS;

function semanticChildren(n: HsonNode): HsonNode[] {
    const kids = (n._content ?? []).filter(is_Node);
    if (kids.length === 1 && kids[0]._tag === "_elem") {
        return (kids[0]._content ?? []).filter(is_Node);
    }
    return kids;
}

function collapseTrivial(n: HsonNode): HsonNode {
    if (n._tag === "_elem") {
        const c = (n._content ?? []).filter(is_Node);
        if (c.length === 1 && LEAF.has(c[0]._tag)) return c[0];
    }
    return n;
}

function compareLeaf(a: HsonNode, b: HsonNode, path: string, diffs: string[]) {
    if (!(LEAF.has(a._tag) && LEAF.has(b._tag))) return false;
    const va = a._content?.[0];
    const vb = b._content?.[0];
    if (va !== vb) diffs.push(`Leaf mismatch @ ${path}: ${JSON.stringify(va)} vs ${JSON.stringify(vb)}`);
    return true;
}

function compareChildrenByIndex(
    aKids: HsonNode[],
    bKids: HsonNode[],
    path: string,
    diffs: string[],
    compareFn: (a: HsonNode, b: HsonNode, p: string) => void
) {
    if (aKids.length !== bKids.length) {
        diffs.push(`Child count mismatch @ ${path}: ${aKids.length} vs ${bKids.length}`);
    }
    const len = Math.min(aKids.length, bKids.length);
    for (let i = 0; i < len; i++) compareFn(aKids[i], bKids[i], `${path}._content[${i}]`);
}

function compareChildrenByKeyForObj(
    aKids: HsonNode[],
    bKids: HsonNode[],
    path: string,
    diffs: string[],
    compareFn: (a: HsonNode, b: HsonNode, p: string) => void
) {
    const mapA = new Map<string, HsonNode>();
    const mapB = new Map<string, HsonNode>();
    for (const n of aKids) mapA.set(n._tag, n);
    for (const n of bKids) mapB.set(n._tag, n);

    for (const k of mapA.keys()) if (!mapB.has(k)) diffs.push(`Key missing in B @ ${path}.${k}`);
    for (const k of mapB.keys()) if (!mapA.has(k)) diffs.push(`Key missing in A @ ${path}.${k}`);

    for (const k of mapA.keys()) {
        const aa = mapA.get(k)!;
        const bb = mapB.get(k);
        if (!bb) continue;
        compareFn(aa, bb, `${path}.${k}`);
    }
}

function stableStringify(obj: Record<string, unknown>): string {
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = obj[k];
    return JSON.stringify(out);
}

function compareAttrs(a?: Record<string, any>, b?: Record<string, any>, path = ""): string[] {
    const diffs: string[] = [];
    const A = a ?? {};
    const B = b ?? {};

    const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
    for (const k of keys) {
        if (!(k in A)) { diffs.push(`Missing attr in A @ ${path}["${k}"]`); continue; }
        if (!(k in B)) { diffs.push(`Missing attr in B @ ${path}["${k}"]`); continue; }

        const va = A[k], vb = B[k];
        const bothObj = typeof va === "object" && va && typeof vb === "object" && vb;

        if (k === "style" && bothObj && !Array.isArray(va) && !Array.isArray(vb)) {
            if (stableStringify(va) !== stableStringify(vb)) diffs.push(`Style mismatch @ ${path}["style"]`);
            continue;
        }
        if (bothObj) {
            if (stableStringify(va) !== stableStringify(vb)) diffs.push(`Attr object mismatch @ ${path}["${k}"]`);
        } else {
            if (va !== vb) diffs.push(`Attr value mismatch @ ${path}["${k}"]: ${JSON.stringify(va)} vs ${JSON.stringify(vb)}`);
        }
    }
    return diffs;
}

function compareContent(aC?: any[], bC?: any[], path = ""): string[] {
    const A = aC ?? [];
    const B = bC ?? [];
    const diffs: string[] = [];
    if (A.length !== B.length) diffs.push(`_content length mismatch @ ${path}: ${A.length} vs ${B.length}`);
    const len = Math.min(A.length, B.length);
    for (let i = 0; i < len; i++) {
        diffs.push(...compareAny(A[i], B[i], `${path}[${i}]`));
    }
    return diffs;
}

function compare(nodeA: HsonNode, nodeB: HsonNode, path: string): string[] {
    const diffs: string[] = [];
    if (nodeA._tag !== nodeB._tag) diffs.push(`_tag mismatch @ ${path}: "${nodeA._tag}" vs "${nodeB._tag}"`);

    const collapseA = collapseTrivial(nodeA);
    const collapseB = collapseTrivial(nodeB);

    // BUGFIX: compare A vs B (was A vs A)
    diffs.push(...compareAttrs(collapseA._attrs, collapseB._attrs, `${path}._attrs`));
    if (compareLeaf(collapseA, collapseB, path, diffs)) return diffs;

    const aKids = semanticChildren(collapseA);
    const bKids = semanticChildren(collapseB);

    if (collapseA._tag === "_obj" && collapseB._tag === "_obj") {
        compareChildrenByKeyForObj(aKids, bKids, path, diffs, (x, y, p) => diffs.push(...compare(x, y, p)));
    } else if (collapseA._tag === "_arr" && collapseB._tag === "_arr") {
        compareChildrenByIndex(aKids, bKids, path, diffs, (x, y, p) => diffs.push(...compare(x, y, p)));
    } else {
        compareChildrenByIndex(aKids, bKids, path, diffs, (x, y, p) => diffs.push(...compare(x, y, p)));
    }

    return diffs;
}

function comparePlainObjects(a: Record<string, unknown>, b: Record<string, unknown>, path: string): string[] {
    const diffs: string[] = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
        if (!(k in a)) { diffs.push(`Key missing in A @ ${path}.${k}`); continue; }
        if (!(k in b)) { diffs.push(`Key missing in B @ ${path}.${k}`); continue; }
        diffs.push(...compareAny(a[k], b[k], `${path}.${k}`));
    }
    return diffs;
}

function compareAny(a: any, b: any, path: string): string[] {
    if (typeof a !== typeof b) return [`Type mismatch @ ${path}: ${typeof a} vs ${typeof b}`];

    if (a === null || b === null) return (a === b) ? [] : [`Null mismatch @ ${path}: ${a} vs ${b}`];

    if (typeof a !== "object") return (a === b) ? [] : [`Primitive mismatch @ ${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];

    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b)) return [`Type mismatch @ ${path}: array vs non-array`];
        return compareContent(a, b, path);
    }

    const aIsNode = is_Node(a);
    const bIsNode = is_Node(b);
    if (aIsNode !== bIsNode) return [`Type mismatch @ ${path}: ${aIsNode ? "HsonNode" : "object"} vs ${bIsNode ? "HsonNode" : "object"}`];

    if (aIsNode && bIsNode) return compare(a as HsonNode, b as HsonNode, path);

    return comparePlainObjects(a as Record<string, unknown>, b as Record<string, unknown>, path);
}

// Public API
export function compare_nodes(a: HsonNode, b: HsonNode, verbose = true): string[] {
    if (!a || !b) throw new Error(`compare_nodes: missing input (a:${JSON.stringify(a)}, b:${JSON.stringify(b)})`);
    if (a === b) {
        throw new Error('compareNodes called with identical references');
    }
    const diffs = compare(a, b, "/_root");

    if (!verbose) return diffs;

    // Collapsed, data-rich group
    console.groupCollapsed(
        diffs.length ? `❌ node-compare FAIL  (${diffs.length} diffs)` : "✅ node-compare OK"
    );
    console.log("A (snip):", snip(make_string(a)));
    console.log("B (snip):", snip(make_string(b)));

    if (diffs.length) {
        console.groupCollapsed("diffs");
        // show first handful; full array is still accessible
        for (let i = 0; i < Math.min(diffs.length, 20); i++) console.log(diffs[i]);
        if (diffs.length > 20) console.log(`… +${diffs.length - 20} more`);
        console.groupEnd();
    }
    console.groupEnd();

    // Loud line outside the group so it’s not swallowed
    if (diffs.length) {
        console.error(`FAILED • node-compare: first diff — ${diffs[0]}`);
        console.group(`node-compare FAIL`);
        console.log('A:', snip(make_string(a), 2000));
        console.log('B:', snip(make_string(b), 2000));
        console.groupEnd();
    }

    return diffs;
}

function logCmp(path: string[], a: HsonNode, b: HsonNode, equal: boolean): void {
    if (equal) return; // too noisy otherwise
    console.group(`node-compare FAIL at /${path.join('/')}`);
    console.log('A:', snip(make_string(a), 2000));
    console.log('B:', snip(make_string(b), 2000));
    console.groupEnd();
}