// livetree2.ts

import { ensure_quid, get_node_by_quid } from "../../quid/data-quid.quid";
import { HsonNode } from "../../types-consts/node.types";
import { ListenerBuilder } from "../../types-consts/listen.types";
import { element_for_node } from "../../utils/tree-utils/node-map-helpers.utils";
import { css_for_quids as manageCss } from "./livetree-methods/css-manager";
import { CssHandle } from "../../types-consts/css.types";
import { remove2 } from "./livetree-methods/remove2";
import { createAppend } from "./livetree-methods/create-append";
import { getNodeFormValue, getNodeText, setNodeContent, setNodeFormValue } from "./livetree-methods/content";
import { DataManager2 } from "./livetree-methods/data-manager2.tree";
import { empty2 } from "./livetree-methods/empty2";
import { buildListener } from "./livetree-methods/listen2";
import { findAllFor, makeFindFor } from "./livetree-methods/find2";
import { clearFlagsImpl, getAttrImpl, removeAttrImpl, setAttrsImpl, setFlagsImpl } from "./livetree-methods/attrs-manager";
import { remove_child2 } from "./livetree-methods/remove-child2";
import { StyleManager2 } from "./livetree-methods/style-manager2.utils";
import { HsonQuery, LiveTreeCreateHelper, TreeSelector } from "../../types-consts/livetree.types";
import { appendBranch } from "./livetree-methods/append-other";
import {  make_tree_create } from "./livetree-methods/create-typed";
import { FindWithById, LiveTreeCreateAppend, NodeRef } from "../../types-consts/livetree.types";
import { Primitive } from "../../core/types-consts/core.types";


function makeRef(node: HsonNode): NodeRef {
  /*  Ensure the node has a stable QUID and keeps NODE_ELEMENT_MAP happy. */
  const q = ensure_quid(node);

  const ref: NodeRef = {
    q,
    resolveNode(): HsonNode { /* exposes the node itself */
      // if we later introduce a global QUID→node map,
      // this is where to switch to a lookup.
      return node;
    },

    resolveElement(): Element | undefined { /* exposes the DOM Element . */
      return element_for_node(node) ?? undefined;
    },
  };

  return ref;
}
// function makeRef(node: HsonNode): NodeRef2 {
//   const meta = node._meta ?? {};
//   const qExisting = (meta as any)._quid as string | undefined;

//   // If we already have a QUID, never change it.
//   const q = qExisting ?? ensure_quid(node); // ensure_quid should *only* create when missing

//   const ref: NodeRef2 = {
//     q,
//     resolveNode(): HsonNode | undefined {
//       // ideally via NODE_ELEMENT_MAP’s inverse, not tree walk
//       return get_node_by_quid(q);  // or your actual helper
//     },
//     resolveElement(): Element | undefined {
//       return element_for_node(get_node_by_quid(q)!); // or whatever your DOM map helper is
//     },
//   };

//   return ref;
// }

export class LiveTree {
  /*---------- the HsonNode being referenced */
  private nodeRef!: NodeRef;
  /*---------- the root node or historic root node */
  private hostRoot!: HsonNode;
  /*---------- inline style editor */
  private styleManagerInternal: StyleManager2 | undefined = undefined;
  /*---------- .dataset editor */
  private datasetManagerInternal: DataManager2 | undefined = undefined;
  /*----------  create quid, register node (NODE_ELEMENT_MAP), assign resolve*() methods */
  private setRef(input: HsonNode | LiveTree): void {
    if (input instanceof LiveTree) {
      this.nodeRef = makeRef(input.node);
      return;
    }
    this.nodeRef = makeRef(input);
  }
  /*----------  set legacy root node */
  private setRoot(input: HsonNode | LiveTree): void {
    if (input instanceof LiveTree) {
      this.hostRoot = input.hostRoot;
      if (!this.hostRoot) { throw new Error('could not set host root'); }
      return;
    }
    this.hostRoot = input; /* HsonNode fallback */
    if (!this.hostRoot) { throw new Error('could not set host root'); }
  }

  constructor(input: HsonNode | LiveTree) {
    this.setRoot(input);
    this.setRef(input);
  }

  /*------  attach liveTree as child nodes */
  public append = appendBranch;
  /*------ clear all child nodes */
  public empty = empty2;
  /*------  remove a child node */
  public removeChild = remove_child2;
  /*------ remove self */
  public remove = remove2;
  /*------ find and return a LiveTree; with optional .byId(), .must [throw if undefined] */
  public find: FindWithById = makeFindFor(this);
  /*------ find and return a TreeSelector (LiveTree[]) */
  public findAll = (q: HsonQuery | string): TreeSelector => findAllFor(this, q);
  // /*------ append a new HsonNode to the tree graph, populating the element on the DOM as well */
  // public createAppend: LiveTreeCreateAppend = createAppend;           
  // deprecated in favor of:
  /*------ like createAppend but extends a typed interface for native HTML tags: <div>, <span>, <etc> */
  public get create(): LiveTreeCreateHelper {
    return make_tree_create(this);
  }

  /*------ returns the tree node's data-_quid UID */
  public get quid(): string {
    return this.nodeRef.q;
  }

  /*---------- return legacy root */
  public getHostRoots(): HsonNode {
    return this.hostRoot;
  }

  /* internal: allow a branch to inherit host roots when grafted/appended */
  adoptRoots(root: HsonNode): this {
    this.hostRoot = root;
    return this;
  }
  /*---------- return LiveTree's referenced node */
  public get node(): HsonNode {
    const n = this.nodeRef.resolveNode();
    if (!n) {
      throw new Error("LiveTree2.node: ref did not resolve");
    }
    return n;
  }

  /*---------- managers & adapters ---------- */

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

  /*------ css handling keyed to node's [data-_quid] selector */
  public get css(): CssHandle {
    return manageCss([this.quid]);
  }

  /*------ add/remove event listeners (acts on node's HTMLElement) */
  public get listen(): ListenerBuilder {
    return buildListener(this);
  }

  /* ---------- attribute / flags API ---------- */

  public getAttr(name: string): Primitive | undefined {
    return getAttrImpl(this, name);
  }
  public removeAttr(name: string): LiveTree {
    return removeAttrImpl(this, name);
  }
  /* flags are attributes where key="key" or true */
  public setFlags(...names: string[]): LiveTree {
    return setFlagsImpl(this, ...names);
  }
  public removeFlags(...names: string[]): LiveTree { 
    return clearFlagsImpl(this, ...names);
  }
  // TODO TASK
  toggleFlags(...names: string[]): LiveTree {
    console.warn('not built yet!');
    return this;
  }

  /* accepts a single property or a CSS object */
  public setAttrs(name: string, value: string | boolean | null): LiveTree;
  public setAttrs(map: Record<string, string | boolean | null>): LiveTree;
  public setAttrs(
    nameOrMap: string | Record<string, string | boolean | null>,
    value?: string | boolean | null,
  ): LiveTree {
    return setAttrsImpl(this, nameOrMap, value);
  }

  /*  ---------- content API ---------- */

  public setText(value: Primitive): LiveTree {
    setNodeContent(this.node, value);
    return this;
  }
  public getText(): string {
    return getNodeText(this.node);
  }
  public setFormValue(value: string, opts?: { silent?: boolean }): LiveTree {
    setNodeFormValue(this.node, value, opts);
    return this;
  }
  public getFormValue(): string {
    return getNodeFormValue(this.node);
  }

  /*  ---------- DOM adapter ---------- */

  public asDomElement(): Element | undefined {
    const firstRef = this.nodeRef;
    if (!firstRef) return undefined;
    return firstRef.resolveElement();
  }
}