import { HsonNode } from "../../types-consts";

// === Identity + addressing ===
export type DataQuid = string;

export type PathSeg = string | number;
export type Path = ReadonlyArray<PathSeg>;                 // ex: ['ingredients', 3, 'name']
export type PathStr = string;                              // ex: "/ingredients/3/name"

// Utility: canonical JSON Pointer; keep escaping centralized.
export function toPointer(path: Path): PathStr {
  let out: string = "";
  for (const seg of path) {
    const s: string = typeof seg === "number" ? String(seg) : seg.replace(/~/g, "~0").replace(/\//g, "~1");
    out += "/" + s;
  }
  return out === "" ? "/" : out;
}

// === Patch grammar (discriminated union) ===
export type OriginTag =
  | "store"
  | "dom:tree"
  | "dom:map";

export type TxId = string;

export type OpSetValue = {
  kind: "set:value";                // replace primitive or node payload
  path: Path;
  value: unknown;
};

export type OpSetAttr = {
  kind: "set:attr";                 // set/replace attribute on a node
  path: Path;
  name: string;
  value: string | number | boolean | null;
};

export type OpInsert = {
  kind: "arr:insert";               // arrays only
  path: Path;                       // path to array
  index: number;
  node: HsonNode;                   // your NEW node shape
};

export type OpRemove = {
  kind: "arr:remove";               // arrays only
  path: Path;                       // path to array
  index: number;
};

export type OpMove = {
  kind: "arr:move";                 // arrays only
  path: Path;                       // path to array
  from: number;
  to: number;
};

export type PatchOp =
  | OpSetValue
  | OpSetAttr
  | OpInsert
  | OpRemove
  | OpMove;

export type Patch = {
  tx: TxId;
  origin: OriginTag;
  ops: ReadonlyArray<PatchOp>;
};

// === Store interface (single source of truth) ===
export interface Store {
  read(path: Path): unknown;          // JSON view
  readNode(path: Path): HsonNode;     // NEW/HSON node view
  transact(patch: Patch): void;       // apply + notify
  subscribe(handler: (patch: Patch) => void): () => void; // returns unsubscribe
}
