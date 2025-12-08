//// liveTree outline currently; my meta-comments begin with ////
/**
 * LiveTree
 * --------
 * A chainable, node-centric API for manipulating DOM backed by HSON IR.
 
 //// leaving in the commentary so we can make sure we untangle this properly
 *
 * Fundamental design points:
 *
 * 1. **Selection is always HsonNodes.**
 *    LiveTree never stores raw DOM Elements. Internally it tracks
 *    `selectedNodes: HsonNode[]`.
 *
 * 2. **DOM resolution is done lazily via QUID.**
 *    Real Elements are obtained by looking up each node’s QUID inside
 *    `NODE_ELEMENT_MAP`. This ensures:
 *      - selection remains stable even if the DOM moves,
 *      - no direct Element references leak out of the public API,
 *      - DOM sync is consistent and centralized.
 *
 * 3. **Pure, chainable discovery.**
 *    `find()` and `findAll()` return *new* LiveTree instances with a
 *    derived selection. Mutating methods (`setAttrs`, `remove`,
 *    `setContent`, etc.) modify the Nodes and update mapped DOM.
 *
 * 4. **Nodes-first, DOM-second.**
 *    The HSON Node tree is the source of truth. DOM writes happen
 *    only if the node is currently mounted.
 *
 * 5. **Minimal surface.**
 *    LiveTree aims to expose only the primitives needed for ergonomic
 *    DOM manipulation: selection, attributes, dataset, css facade,
 *    content manipulation, and structural operations like append/remove.
 *
 * In short: LiveTree gives ergonomic DOM manipulation without ever
 * exposing the DOM directly and without losing the formal structure
 * provided by the HSON node IR.
 */

type NodeRef = {
  q: string;
  resolveNode(): HsonNode | undefined;
  resolveElement(): Element | undefined;
};

// finder methods (convert results → refs)
type FindWithById = { // these are fine; standard tree-returning methods
  // soft single
  (q: HsonQuery | string): LiveTree | undefined;

  // soft single by id
  byId(id: string): LiveTree | undefined;

  // hard single
  must(q: HsonQuery | string, label?: string): LiveTree;

  // hard single by id
  mustById(id: string, label?: string): LiveTree;
};

interface MultiResult { // AKA TreeSelector??
  // batch ops
  asBranch(): LiveTree;
  style: LiveTree['style'];                       // ← simple, correct

  // attrs (forward to existing LiveTree methods)
  setAttrs(name: string, value: string | boolean | null): any;
  setAttrs(map: Record<string, string | boolean | null>): any;
  getAttrs(): Record<string, string> | undefined;

  // array-ish
  toArray(): LiveTree[];
  forEach(fn: (node: LiveTree, i: number) => void): void;
  map<T>(fn: (node: LiveTree, i: number) => T): T[];

  // convenience expected by callers
  count(): number;
  at(i: number): LiveTree | undefined;
}

function makeMulti(found: HsonNode[], roots?: HsonNode[]): MultiResult {
    //// I'm leaving the body in here because I think this is probably the site where we're going to have to disambiguate LiveTrees vs TreeSelector
  const branch = new LiveTree(found);            // batch target (all)
  const arr = found.map(n => new LiveTree([n])); // single-node wrappers

  function setAttrs(nameOrMap: any, val?: any) {
    // forward to LiveTree.setAttrs
    return (branch as any).setAttrs(nameOrMap, val);
  }

  return {
    asBranch() { return branch; },

    // getter preserves the exact type of LiveTree['style']
    get style() { return branch.style; },

    setAttrs,                                      // overload impl
    getAttrs() { return (branch as any).getAttrs?.(); },

    toArray() { return arr; },
    forEach(fn) { for (let i = 0; i < arr.length; i++) fn(arr[i], i); },
    map(fn) { return arr.map(fn); },

    count() { return arr.length; },
    at(i) { return (i >= 0 && i < arr.length) ? arr[i] : undefined; },
  };
}


function makeRef(n: HsonNode): NodeRef {
 // calls ensure_quid etc
}

export class LiveTree {
  private selected: NodeRef[] = [];
  private rootRefs: HsonNode[] = [];
  /*   managers */
  private styleManager: StyleManager | undefined = undefined;
  private datasetManager: DatasetManager | undefined = undefined;
  public appendCreate: AppendCreateHelper;

  constructor(input?: HsonNode | HsonNode[] | LiveTree) {
    this.setRoots(input);
    this.setSelected(input);
    this.appendCreate = makeAppendCreateHelper(this); // will rename to createAppend

  }


  /* nodes view (read-only) */
  private get selectedNodes(): HsonNode[] {
   // TreeSelector only?
  }
  // NEW: helper to read QUIDs from the current selection
  private get selectedQuids(): string[] {
   // also a TreeSelector-only method 
  }

  private setSelected(input?: HsonNode | HsonNode[] | LiveTree): void {
    
  }

  private setRoots(input?: HsonNode | HsonNode[] | LiveTree) {
// a lot of this root work kind of bothers me, but maybe it's necessary
  }

  /* helper to temporarily run legacy logic that expects nodes */
  private withNodes<T>(fn: (nodes: HsonNode[]) => T): T {
  }

  // Remove references to nodes from any known root trees
  private pruneFromRoots(targets: HsonNode[]): void {
   
  }

  // internal: allow a branch to inherit host roots when grafted/appended
  adoptRoots(roots: HsonNode[]): this {
    
  }

  public async afterPaint(): Promise<this> {
    
  }

  /*  Finds the first descendant matching a query  */
  public append = append;
  public appendMulti(branches: readonly LiveTree[]): this {
  
  }

  public empty = empty;
  public removeChild = remove_child;
  public getContent = get_content;
  
  public getSelection(): HsonNode[] {
    
  }
  
 

  get listen(): ListenerBuilder {
  }

  get style(): StyleManager {
    
  }
  
  get data(): DatasetManager {
    
  }

  get css(): CssHandle {
    return cssForQuids(this.selectedQuids); // selectedQuids feels like a TreeSelector method only
  }

  get find(): FindWithById {
   
  }

  findAll(q: HsonQuery | string): MultiResult {
  
  }

  at(index: number): LiveTree {
    
  }

  setAttrs(name: string, value: string | boolean | null): this;
  setAttrs(map: Record<string, string | boolean | null>): this;
  setAttrs(a: string | Record<string, string | boolean | null>, v?: 
  }


  private _setOne(name: string, value: string | boolean | null): this {
   
  }


  setFlags(...names: string[]): this {
   
  }

  remove(): this {
    
  }

  /*   action/setter methods   */

  setValue(value: string, opts?: { silent?: boolean }): this {
    
  }

  setContent(v: Primitive): this {
   //// both types? (LiveTree/TreeSelector)
  }



  removeAttr($name: string): this {
  }


  /*  -vvv- reader methods -vvv- */

  getAttr($attr: string): Primitive | undefined {
   //// this would be weird with TreeSelector; it would need to be able to return multiple
  }

  getFirstText(): string {
   
  }

  count(): number { ////TreeSelector
    return this.selectedNodes.length; 
  }

  getValue(): string { 
    if (this.selectedNodes.length === 0) return '';
    const liveElement = getElementForNode(this.selectedNodes[0]);
    return (liveElement as HTMLInputElement | HTMLTextAreaElement)?.value ?? ''; 
  }

  asDomElement(): Element | undefined {
    
  }


  sourceNode(): HsonNode[] {
  
  }

  /**
   * helper method to perform the recursive search.
   */
  private search($nodes: HsonNode[], $query: HsonQuery, $options: { findFirst: boolean }): HsonNode[] {
   
  }

}
