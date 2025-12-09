// livetree2.ts

import { HsonNode, Primitive, HsonQuery } from "../../types-consts";
import { ListenerBuilder } from "../../types-consts/listen.types";
import { TagName } from "../../types-consts/tree.types";
import { cssForQuids, CssHandle } from "../livetree/livetree-methods/css-manager";
import { createAppend2 } from "./livetree-methods/append-create2";
import { append2 } from "./livetree-methods/append2";
import { DataManager2 } from "./livetree-methods/data-manager2.tree";
import { buildListener } from "./livetree-methods/listener-builder.tree";
import { findAllFor, getAttrImpl, makeFindFor, removeAttrImpl, setAttrsImpl, setFlagsImpl } from "./livetree-methods/livetree-find2";
import { StyleManager2 } from "./livetree-methods/style-manager2.utils";
import { FindWithById2, LiveTreeCreateAppend, NodeRef2 } from "./livetree2.types";
import {  TreeSelector } from "./tree-selector";


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
  private nodeRef: NodeRef2 | null = null;
  private hostRoot: HsonNode[] = [];

  private styleManagerInternal: StyleManager2 | undefined = undefined;
  private datasetManagerInternal: DataManager2 | undefined = undefined;

  // attach core structural methods via free functions
  public append = append2;
  public empty: () => LiveTree2;
  public removeChild: (query: string | HsonQuery) => LiveTree2;
  public remove: () => LiveTree2;
  public find: FindWithById2 = makeFindFor(this);
  public findAll = (q: HsonQuery | string): TreeSelector =>
    findAllFor(this, q);
  // “create then append” helper with index / .at(...) sugar
  public createAppend: LiveTreeCreateAppend = createAppend2;

  constructor(input?: HsonNode | LiveTree2) {
    this.setRoots(input);
    this.setSelected(input);
    if (!this.nodeRef) throw new Error('liveTree has no node ref');

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

  public get quid(): string {
    if (!this.nodeRef) {
      throw new Error("LiveTree2.quid(): no nodeRef bound");
    }
    return this.nodeRef.q;
  }

  // ---------- root wiring ----------
  public getRootRefs(): HsonNode[] {
    return this.hostRoot;
  }


  private setRoots(input?: HsonNode | LiveTree2): void {
    if (!input) {
      this.hostRoot = [];
      return;
    }

    if (input instanceof LiveTree2) {
      this.hostRoot = input.hostRoot.length > 0
        ? input.hostRoot
        : [input.node];            // fallback: self-rooted
      return;
    }

    this.hostRoot = [input];      // raw HsonNode entrypoint
  }

  public getHostRoots(): readonly HsonNode[] {
    return this.hostRoot;
  }

  private setSelected(input?: HsonNode | LiveTree2): void {
    // empty tree state – allowed, but unusable until bound
    if (!input) {
      throw new Error('no input provided to LiveTree');
    }

    if (input instanceof LiveTree2) {
      this.nodeRef = makeRef(input.node);
      return;
    }

    // HsonNode case
    this.nodeRef = makeRef(input);
  }

  public get node(): HsonNode {
    const ref = this.nodeRef;
    if (!ref) {
      throw new Error("LiveTree2.node: no node bound");
    }
    const n = ref.resolveNode();
    if (!n) {
      throw new Error("LiveTree2.node: ref did not resolve");
    }
    return n;
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
    return cssForQuids([this.quid]);
  }

  public get listen(): ListenerBuilder {
    return buildListener(this);
    throw new Error("LiveTree2.listen: ListenerBuilder not wired yet");
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
    return setAttrsImpl(this, nameOrMap, value);
  }

  public removeAttr(name: string): LiveTree2 {
    return removeAttrImpl(this, name);
  }

  public setFlags(...names: string[]): LiveTree2 {
    return setFlagsImpl(this, ...names);
  }

  public getAttr(name: string): Primitive | undefined {
    return getAttrImpl(this, name);
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
    const firstRef = this.nodeRef;
    if (!firstRef) return undefined;
    return firstRef.resolveElement();
  }

  // internal: allow a branch to inherit host roots when grafted/appended
  adoptRoots(roots: HsonNode[]): this {
    this.hostRoot = roots;
    return this;
  }
}