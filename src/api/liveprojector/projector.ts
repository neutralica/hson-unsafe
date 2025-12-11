import { Patch, Path } from "../livemap/types.livemap";

/*************************** 
 * (CURRENTLY UNUSED, TBC)
 ***************************/

export type ProjectorMode = "snapshot" | "dashboard" | "control";

export interface Projector {
  mount(root: Element, path: Path, mode: ProjectorMode): void;
  unmount(): void;
  // Called by the substrate when *other* actors mutate the model.
  onPatch(patch: Patch): void;
}
