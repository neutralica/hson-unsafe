// livetree2.ts

import { HsonNode, Primitive, HsonQuery } from "../../types-consts";
import { ListenerBuilder } from "../../types-consts/listen.types";
import { TagName } from "../../types-consts/tree.types";
import { parse_selector } from "../../utils/tree-utils/parse-selector.utils";
import { CssHandle } from "../livetree/livetree-methods/css-manager";
import { DatasetManager } from "../livetree/livetree-methods/dataset-manager.tree";
import { createAppend2 } from "./livetree-methods/append-create2";
import { append2 } from "./livetree-methods/append2";
import { DataManager2 } from "./livetree-methods/data-manager2.tree";
import { searchNodes } from "./livetree-methods/node-search2";
import { StyleManager2 } from "./livetree-methods/style-manager2.utils";
import { FindWithById2, LiveTreeCreateAppend, NodeRef2 } from "./livetree2.types";
import { makeTreeSelector, TreeSelector } from "./tree-selector";


// TODO: import from existing modules once you hook them up
// import { cssForQuids } from "../css-manager";
// import { makeListenerBuilder } from "../listener-manager";
// import { makeFinder } from "./search-manager";
// import { appendImpl } from "./content-append";
// import { emptyImpl, removeChildImpl, removeImpl } from "./content-struct";
// import { setAttrsImpl, removeAttrImpl, setFlagsImpl, getAttrImpl } from "./attrs-manager";
// import { createAppendImpl } from "./create-append";

function makeRef(node: HsonNode): NodeRef2 {
  // This should call your existing ensure_quid / NODE_ELEMENT_MAP logic.
  // For now, stubbed with the `_meta["data-_quid"]` convention:
  const meta = node._meta ?? {};
  const qRaw = (meta as Record<string, unknown>)["data-_quid"];
  const q = typeof qRaw === "string" ? qRaw : (() => {
    throw new Error("makeRef: node missing data-_quid");
  })();

  const ref: NodeRef2 = {
    q,
    resolveNode(): HsonNode | undefined {
      // TODO: wiring into NODE_ELEMENT_MAP; stubbed for now.
      throw new Error('TODO');
      return node;
    },
    resolveElement(): Element | undefined {
      // TODO: plug into your DOM map:
      // return getElementForNode(node);
      // TODO
      throw new Error('TODO');
      return undefined;
    },
  };

  return ref;
}

export class LiveTree2 {
  private nodeRefs: NodeRef2[] = [];
  private rootRefs: HsonNode[] = [];

  private styleManagerInternal: StyleManager2 | undefined = undefined;
  private datasetManagerInternal: DataManager2 | undefined = undefined;

  // attach core structural methods via free functions
  public append = append2;
  public empty: () => LiveTree2;
  public removeChild: (query: string | HsonQuery) => LiveTree2;
  public remove: () => LiveTree2;

  // “create then append” helper with index / .at(...) sugar
  public createAppend: LiveTreeCreateAppend = createAppend2;

  constructor(input?: HsonNode | LiveTree2) {
    this.setRoots(input);
    this.setSelected(input);

    // wire method fields to implementations

    this.empty = () => {
      // placeholder
      return this;
    };

    this.removeChild = () => {
      // placeholder
      return this;
    };

    this.remove = () => {
      // placeholder
      return this;
    };

    // createAppend helper: normalizes tags and calls append under the hood
    const self = this;
    this.createAppend = function (
      this: LiveTree2,
      tag: TagName | TagName[],
      index?: number,
    ) {
      const tags: TagName[] = Array.isArray(tag) ? tag : [tag];

      const applyAt = (ix?: number): LiveTree2 => {
        // the parents are the currently selected nodes.

        const html = tags.map(t => `<${t}></${t}>`).join("");

        // use your existing pipeline:
        // const branch = hson.fromTrustedHtml(html).liveTree().asBranch();
        // self.append(branch, ix);

        void html;
        void ix;

        return self;
      };

      if (typeof index === "number") {
        return applyAt(index);
      }

      return {
        at(ix: number): LiveTree2 {
          return applyAt(ix);
        },
      };
    };
  }

  // ---------- root wiring ----------
  public getRootRefs(): HsonNode[] {
    return this.rootRefs;
  }

  private setRoots(input?: HsonNode | HsonNode[] | LiveTree2): void {
    if (!input) {
      this.rootRefs = [];
      return;
    }

    if (input instanceof LiveTree2) {
      if (input.rootRefs.length > 0) {
        // copy, don’t share the array
        this.rootRefs = [...input.rootRefs];
      } else {
        // fall back to its anchor node
        this.rootRefs = [input.node];
      }
      return;
    }

    if (Array.isArray(input)) {
      this.rootRefs = [...input]; // defensive copy
      return;
    }

    // single HsonNode
    this.rootRefs = [input];
  }

  private setSelected(input?: HsonNode | LiveTree2): void {
    // empty tree state – allowed, but unusable until bound
    if (!input) {
      this.nodeRefs = [];
      return;
    }

    if (input instanceof LiveTree2) {
      const refs = input.nodeRefs;

      if (refs.length === 0) {
        // propagate emptiness
        this.nodeRefs = [];
        return;
      }

      if (refs.length > 1) {
        // this should never happen if we keep LiveTree2 “single-node” by design
        throw new Error("LiveTree2.setSelected(): source LiveTree2 has multiple nodeRefs");
      }

      this.nodeRefs = [refs[0]];
      return;
    }

    // HsonNode case
    this.nodeRefs = [makeRef(input)];
  }

  public get node(): HsonNode {
    const ref = this.nodeRefs[0];
    if (!ref) {
      throw new Error("LiveTree2.node: no node bound");
    }
    const n = ref.resolveNode();
    if (!n) {
      throw new Error("LiveTree2.node: ref did not resolve");
    }
    return n;
  }


  /**
   * Returns the single “root node” for this LiveTree.
   * Throws if there are zero or multiple selected nodes.
   */
  public get rootNode(): HsonNode {
    if (this.rootRefs.length === 0) {
      throw new Error("LiveTree2.rootNode(): no rootRefs");
    }
    if (this.rootRefs.length > 1) {
      throw new Error("LiveTree2.rootNode(): multiple roots; use rootRefs directly");
    }
    return this.rootRefs[0];
  }


  // ---------- managers & adapters ----------

  public get style(): StyleManager2 {
    if (!this.styleManagerInternal) {
      this.styleManagerInternal = new StyleManager2(this);
    }
    return this.styleManagerInternal;
  }

  public get data(): DataManager2 {
    if (!this.datasetManagerInternal) {
      this.datasetManagerInternal = new DataManager2(this);
    }
    return this.datasetManagerInternal;
  }

  public get css(): CssHandle {
    // return cssForQuids(this.selectedQuids);
    throw new Error("LiveTree2.css: CssHandle not wired yet");
  }

  public get listen(): ListenerBuilder {
    // return makeListenerBuilder(this.selectedQuids);
    throw new Error("LiveTree2.listen: ListenerBuilder not wired yet");
  }

  // ---------- search / find / findAll ----------

  get find(): FindWithById2 {
    const self = this;

    const base = ((q: HsonQuery | string): LiveTree2 | undefined => {
      const query = typeof q === "string" ? parse_selector(q) : q;
      const found = searchNodes([self.node], query, { findFirst: true });
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

  findAll(q: HsonQuery | string): TreeSelector {
    const query = typeof q === "string" ? parse_selector(q) : q;
    const found = searchNodes([this.node], query, { findFirst: false });
    const trees = found.map(node => new LiveTree2(node));
    return makeTreeSelector(trees);
  }

  // move to TreeSelector
  // /**
  //  * Return the first LiveTree2 in this selection, or throw if none.
  //  * This is the “selector.at(0) but for LiveTree2 itself” convenience.
  //  */
  // public first(): LiveTree2 {
  //   if (this.nodeRefs.length === 0) {
  //     throw new Error("LiveTree2.first(): empty selection");
  //   }
  //   return new LiveTree2(this.node);
  // }

  // ---------- attribute / flags API ----------

  public setAttrs(name: string, value: string | boolean | null): LiveTree2;
  public setAttrs(map: Record<string, string | boolean | null>): LiveTree2;
  public setAttrs(
    nameOrMap: string | Record<string, string | boolean | null>,
    value?: string | boolean | null,
  ): LiveTree2 {
    // TODO: delegate to attrs-manager, iterating this.selectedNodes
    void nameOrMap;
    void value;
    // TODO
    throw new Error('TODO')
    return this;
  }

  public removeAttr(name: string): LiveTree2 {
    // TODO
    void name;
    // TODO
    throw new Error('TODO')
    return this;
  }

  public setFlags(...names: string[]): LiveTree2 {
    // TODO
    void names;
    // TODO
    throw new Error('TODO')
    return this;
  }

  public getAttr(name: string): Primitive | undefined {
    // TODO
    void name;
    // TODO
    throw new Error('TODO')
    return undefined;
  }

  // ---------- content API ----------

  public setContent(value: Primitive): LiveTree2 {
    // TODO: delegate to content-manager, using this.selectedNodes
    void value;
    // TODO
    throw new Error('TODO')
    return this;
  }
  // TODO
  public setValue(value: string, opts?: { silent?: boolean }): LiveTree2 {
    void value;
    void opts;
    throw new Error()
    return this;
  }

  public getValue(): string {
    // throws if unbound
    const n = this.node;

    // find the DOM element for this node
    const el = this.asDomElement();
    if (!el) return ""; // node not mounted yet

    // Only certain elements have .value; check safely
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return el.value ?? "";
    }

    // Non-form elements have no value in the DOM sense
    return "";
  }
  public getFirstText(): string {
    // TODO: walk the node(s) and return first text content
    return "";
  }

  // ---------- DOM adapter ----------

  public asDomElement(): Element | undefined {
    const firstRef = this.nodeRefs[0];
    if (!firstRef) return undefined;
    return firstRef.resolveElement();
  }

  // internal: allow a branch to inherit host roots when grafted/appended
  adoptRoots(roots: HsonNode[]): this {
    this.rootRefs = roots;
    return this;
  }
}