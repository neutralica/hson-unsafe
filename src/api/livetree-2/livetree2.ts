// livetree2.ts

import { ensure_quid } from "../../quid/data-quid.quid";
import { HsonNode, Primitive, HsonQuery } from "../../types-consts";
import { ListenerBuilder } from "../../types-consts/listen.types";
import { TagName } from "../../types-consts/tree.types";
import { getElementForNode } from "../../utils/tree-utils/node-map-helpers.utils";
import { cssForQuids as manageCss, CssHandle } from "../livetree/livetree-methods/css-manager";
import { remove2 } from "../livetree/livetree-methods/remove2";
import { createAppend2 } from "./livetree-methods/append-create2";
import { append2 } from "./livetree-methods/append2";
import { getNodeFormValue, getNodeText, setNodeContent, setNodeFormValue } from "./livetree-methods/content-manager";
import { DataManager2 } from "./livetree-methods/data-manager2.tree";
import { empty2 } from "./livetree-methods/empty2";
import { buildListener } from "./livetree-methods/listener-builder.tree";
import { findAllFor, getAttrImpl, makeFindFor, removeAttrImpl, setAttrsImpl, setFlagsImpl } from "./livetree-methods/livetree-find2";
import { remove_child2 } from "./livetree-methods/remove-child2";
import { StyleManager2 } from "./livetree-methods/style-manager2.utils";
import { FindWithById2, LiveTreeCreateAppend, NodeRef2 } from "./livetree2.types";
import { TreeSelector } from "./tree-selector";


function makeRef(node: HsonNode): NodeRef2 {
  /*  Ensure the node has a stable QUID and keeps NODE_ELEMENT_MAP happy. */
  const q = ensure_quid(node);

  const ref: NodeRef2 = {
    q,
    resolveNode(): HsonNode | undefined { /* close over the node itself */
      // if we later introduce a global QUID→node map,
      // this is where to switch to a lookup.
      return node;
    },

    resolveElement(): Element | undefined { /* handle DOM resolution. */
      return getElementForNode(node) ?? undefined;
    },
  };

  return ref;
}

export class LiveTree2 {
  private nodeRef!: NodeRef2;
  private hostRoot!: HsonNode;
  private styleManagerInternal: StyleManager2 | undefined = undefined;
  private datasetManagerInternal: DataManager2 | undefined = undefined;

  constructor(input: HsonNode | LiveTree2) {
    this.setRoot(input);
    this.setRef(input);
  }

  /*  attach child node(s) */
  public append = append2;
  /* clear all child nodes */
  public empty = empty2;
  /*  remove a child node */
  public removeChild = remove_child2;
  /* remove self */
  public remove = remove2;
  /* find and return a LiveTree; with optional .byId(), .must [throw if undefined] */
  public find: FindWithById2 = makeFindFor(this);
  /* find and return a TreeSelector (LiveTree[]) */
  public findAll = (q: HsonQuery | string): TreeSelector => findAllFor(this, q);
  /* append a new HsonNode to the tree graph, populating the element on the DOM as well */
  public createAppend: LiveTreeCreateAppend = createAppend2;


  public get quid(): string {
    // if (!this.nodeRef) {
    //   throw new Error("LiveTree2.quid(): no nodeRef bound");
    // }
    return this.nodeRef.q;
  }
  
  private setRef(input: HsonNode | LiveTree2): void {
    if (input instanceof LiveTree2) {
      this.nodeRef = makeRef(input.node);
      return;
    }

    this.nodeRef = makeRef(input);
  }

  private setRoot(input: HsonNode | LiveTree2): void {
    if (input instanceof LiveTree2) {
      // CHANGED: no nullish coalescing; hostRoot is always set on LiveTree2 instances
      this.hostRoot = input.hostRoot;
      if (!this.hostRoot) {throw new Error('could not set host root');}
      return;
    }

    // HsonNode case
    this.hostRoot = input;
    if (!this.hostRoot) {throw new Error('could not set host root');}
  }


  public getHostRoots(): HsonNode {
    return this.hostRoot; /* return a safely mutable copy */
  }

  /* internal: allow a branch to inherit host roots when grafted/appended */
  adoptRoots(root: HsonNode): this {
    this.hostRoot = root;
    return this;
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
    return manageCss([this.quid]);
  }
  public get listen(): ListenerBuilder {
    return buildListener(this);
  }

  // ---------- attribute / flags API ----------

  public getAttr(name: string): Primitive | undefined {
    return getAttrImpl(this, name);
  }
  public removeAttr(name: string): LiveTree2 {
    return removeAttrImpl(this, name);
  }
  public setFlags(...names: string[]): LiveTree2 {
    return setFlagsImpl(this, ...names);
  }
  public setAttrs(name: string, value: string | boolean | null): LiveTree2;
  public setAttrs(map: Record<string, string | boolean | null>): LiveTree2;
  public setAttrs(
    nameOrMap: string | Record<string, string | boolean | null>,
    value?: string | boolean | null,
  ): LiveTree2 {
    return setAttrsImpl(this, nameOrMap, value);
  }

  // ---------- content API ----------

  public setText(value: Primitive): LiveTree2 {
    setNodeContent(this.node, value);
    return this;
  }
  public getText(): string {
    return getNodeText(this.node);
  }
  public setFormValue(value: string, opts?: { silent?: boolean }): LiveTree2 {
    setNodeFormValue(this.node, value, opts);
    return this;
  }
  public getFormValue(): string {
    return getNodeFormValue(this.node);
  }

  // ---------- DOM adapter ----------

  public asDomElement(): Element | undefined {
    const firstRef = this.nodeRef;
    if (!firstRef) return undefined;
    return firstRef.resolveElement();
  }
}