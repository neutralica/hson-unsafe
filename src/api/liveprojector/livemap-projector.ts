import { Patch, Path, PathStr, Store, toPointer, TxId } from "../livemap/types.livemap";
import { Projector, ProjectorMode } from "./projector";

export type LiveMapOptions = {
  // Schema hints by path pointer. Keep light for v1.
  schema?: Record<PathStr, SchemaNode>;
  // Collapsing thresholds, lazy render toggles, etc.
  collapseAfter?: number;
};

export type SchemaNode = {
  type?: "object" | "array" | "string" | "number" | "boolean" | "null";
  widget?: "text" | "textarea" | "number" | "checkbox" | "select" | "slider";
  enum?: ReadonlyArray<string>;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  description?: string;
  readonly?: boolean;
  hidden?: boolean;
};

export class LiveMapProjector implements Projector {
  private store: Store;
  private root: Element | null = null;
  private path: Path = [];
  private mode: ProjectorMode = "snapshot";
  private unsubscribe: (() => void) | null = null;
  private opts: LiveMapOptions;

  constructor(store: Store, opts?: LiveMapOptions) {
    this.store = store;
    this.opts = opts ?? {};
  }

  mount(root: Element, path: Path, mode: ProjectorMode): void {
    this.root = root;
    this.path = path;
    this.mode = mode;

    const value: unknown = this.store.read(path);
    // Initial render: produce readable HTML with stable identities.
    root.replaceChildren(this.renderValue(path, value));

    // Event delegation for control mode.
    if (mode === "control") {
      root.addEventListener("change", this.onDomChange);
      root.addEventListener("input", this.onDomInput);
    }

    // Subscribe to store updates for dashboard/control.
    if (mode !== "snapshot") {
      this.unsubscribe = this.store.subscribe((patch) => {
        if (patch.origin === "dom:map") return;           // reentrancy guard
        this.onPatch(patch);
      });
    }
  }

  unmount(): void {
    if (!this.root) return;
    if (this.mode === "control") {
      this.root.removeEventListener("change", this.onDomChange);
      this.root.removeEventListener("input", this.onDomInput);
    }
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
    this.root = null;
  }

  onPatch(patch: Patch): void {
    if (!this.root) return;
    // Cheap path-scoped reconciliation: for each op touching this.path subtree,
    // locate the element by [data-path="<pointer>"] and update only what changed.
    for (const op of patch.ops) {
      // TODO: compute affected pointer(s) and update text/value or rows minimally.
    }
  }

  // --- DOM → Model (two-way) ---
  private onDomInput = (evt: Event): void => {
    if (this.mode !== "control" || !this.root) return;
    const target: EventTarget | null = evt.target;
    if (!(target instanceof HTMLElement)) return;

    const ptr: string | null = target.getAttribute("data-path");
    if (!ptr) return;

    const path: Path = this.fromPointer(ptr);
    const coerced = coerceFromInput(target); // numbers, booleans, enum, etc.
    const patch: Patch = {
      tx: cryptoRandomTx(),
      origin: "dom:map",
      ops: [{ kind: "set:value", path, value: coerced }]
    };
    this.store.transact(patch); // NOTE: origin guard prevents re-entry loop
  };

  private onDomChange = (evt: Event): void => {
    // For controls that commit on change rather than input (select, checkbox).
    this.onDomInput(evt);
  };

  // --- Rendering (snapshot of a subtree) ---
  private renderValue(path: Path, value: unknown): HTMLElement {
    const ptr: string = toPointer(path);

    if (value === null || value === undefined) {
      const span: HTMLSpanElement = document.createElement("span");
      span.setAttribute("data-path", ptr);
      span.setAttribute("data-type", "nullish");
      span.textContent = String(value);
      return span;
    }

    if (Array.isArray(value)) {
      const details: HTMLDetailsElement = document.createElement("details");
      details.setAttribute("data-path", ptr);
      details.setAttribute("data-vsn", "_arr"); // carry VSN as data attribute
      const summary: HTMLElement = document.createElement("summary");
      summary.textContent = `Array [${value.length}]`;
      details.appendChild(summary);

      const list: HTMLOListElement = document.createElement("ol");
      for (let i = 0; i < value.length; i++) {
        const li: HTMLLIElement = document.createElement("li");
        li.appendChild(this.renderValue([...path, i], value[i]));
        list.appendChild(li);
      }
      details.appendChild(list);
      return details;
    }

    if (typeof value === "object") {
      const details: HTMLDetailsElement = document.createElement("details");
      details.setAttribute("data-path", ptr);
      details.setAttribute("data-vsn", "_obj");
      const summary: HTMLElement = document.createElement("summary");
      summary.textContent = "Object";
      details.appendChild(summary);

      const dl: HTMLDListElement = document.createElement("dl");
      const obj: Record<string, unknown> = value as Record<string, unknown>;
      const keys: ReadonlyArray<string> = Object.keys(obj); // policy: source order or alpha—pick and keep consistent
      for (const k of keys) {
        const dt: HTMLElement = document.createElement("dt");
        dt.textContent = k;
        const dd: HTMLElement = document.createElement("dd");
        dd.appendChild(this.renderValue([...path, k], obj[k]));
        dl.appendChild(dt);
        dl.appendChild(dd);
      }
      details.appendChild(dl);
      return details;
    }

    // Primitive
    if (this.mode === "control") {
      // Choose control heuristically; schema can override.
      const { widget } = this.schemaFor(ptr, typeof value);
      if (widget === "number" && typeof value === "number") {
        const input: HTMLInputElement = document.createElement("input");
        input.type = "number";
        input.value = String(value);
        input.setAttribute("data-path", ptr);
        return input;
      }
      if (widget === "checkbox" && typeof value === "boolean") {
        const input: HTMLInputElement = document.createElement("input");
        input.type = "checkbox";
        if (value) input.checked = true; // set only when true to avoid string coercion
        input.setAttribute("data-path", ptr);
        return input;
      }
      // default: text
      const input: HTMLInputElement = document.createElement("input");
      input.type = "text";
      input.value = String(value);
      input.setAttribute("data-path", ptr);
      return input;
    } else {
      // snapshot/dashboard: display only
      const code: HTMLElement = document.createElement("code");
      code.setAttribute("data-path", ptr);
      code.textContent = JSON.stringify(value);
      return code;
    }
  }

  private schemaFor(ptr: PathStr, inferred: string): { widget: SchemaNode["widget"] } {
    const s: SchemaNode | undefined = this.opts.schema ? this.opts.schema[ptr] : undefined;
    if (s && s.widget) return { widget: s.widget };
    if (inferred === "number") return { widget: "number" };
    if (inferred === "boolean") return { widget: "checkbox" };
    return { widget: "text" };
  }

  private fromPointer(ptr: string): Path {
    if (ptr === "/") return [];
    const parts: ReadonlyArray<string> = ptr.split("/").slice(1);
    const out: Path = parts.map((raw) => {
      const seg: string = raw.replace(/~1/g, "/").replace(/~0/g, "~");
      const n: number = Number(seg);
      return Number.isInteger(n) && String(n) === seg ? n : seg;
    });
    return out;
  }
}

// Helper: consistent coercion from DOM control value → model value.
// Keep symmetric with your serializers to avoid drift.
function coerceFromInput(el: HTMLElement): unknown {
  if (el instanceof HTMLInputElement) {
    if (el.type === "number") {
      const n: number = Number(el.value);
      return Number.isFinite(n) ? n : null;
    }
    if (el.type === "checkbox") {
      return !!el.checked;
    }
    return el.value;
  }
  return (el.textContent ?? "").toString();
}

function cryptoRandomTx(): TxId {
  // Not cryptographically strong across all environments; replace per your utilities.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
