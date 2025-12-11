import { HsonNode } from "../../types-consts/node.types";
import { Patch, Path, Store } from "../livemap/types.livemap";
import { Projector, ProjectorMode } from "./projector";


/*************************** 
 * (CURRENTLY UNUSED, TBC)
 ***************************/


export type LiveTreeOptions = {
  // Future: hydration flags, virtualization thresholds, etc.
};

export class LiveTreeProjector implements Projector {
  private store: Store;
  private root: Element | null = null;
  private path: Path = [];
  private mode: ProjectorMode = "snapshot";
  private unsubscribe: (() => void) | null = null;

  constructor(store: Store, _opts?: LiveTreeOptions) {
    this.store = store;
  }

  mount(root: Element, path: Path, mode: ProjectorMode): void {
    this.root = root;
    this.path = path;
    this.mode = mode;


    const node: HsonNode = this.store.readNode(path);
    // TODO: replace this with existing NEW→DOM renderer.
    this.renderInitialDom(node, root);

    // Subscribe to the store and apply minimal DOM patches.
    this.unsubscribe = this.store.subscribe((patch) => {
      if (patch.origin === "dom:tree") return;            // reentrancy guard
      this.onPatch(patch);
    });
  }

  unmount(): void {
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
    this.root = null;
  }

  onPatch(patch: Patch): void {
    if (!this.root) return;
    // TODO: For each op that touches this.path subtree, compute and apply minimal DOM updates.

  }

  private renderInitialDom(node: HsonNode, root: Element): void {
    // TODO: Call DOM projector.
  }
}
