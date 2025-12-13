// ----------------------------------------------
// Keyframes names are identifiers (CSS allows more, but keep it simple).
// If you later need escaping/quoting, you can widen this.
// ----------------------------------------------
export type KeyframesName = string;

// ----------------------------------------------
// Keyframe selectors: from/to or a percentage.
// We keep percentage as a string so the caller can pass "12.5%" etc.
// ----------------------------------------------
export type KeyframeSelector = "from" | "to" | `${number}%`;

// ----------------------------------------------
// A declaration map used inside a keyframe block.
// Values are raw CSS value text, same as your other CSS manager pieces.
// ----------------------------------------------
export type CssDeclMap = Readonly<Record<string, string>>;

// ----------------------------------------------
// Canonical single frame shape.
// ----------------------------------------------
export type KeyframeStep = Readonly<{
  // Which keyframe selector this step applies to.
  at: KeyframeSelector;

  // The declarations inside the frame.
  // Example: { transform: "rotate(90deg)", "--angle": "90deg" }
  decls: CssDeclMap;
}>;

// ----------------------------------------------
// Canonical stored shape for a full @keyframes block.
// ----------------------------------------------
export type KeyframesDef = Readonly<{
  // The keyframes name.
  name: KeyframesName;

  // Steps, in a deterministic order (we'll normalize).
  steps: readonly KeyframeStep[];
}>;

// ----------------------------------------------
// Input option A: object form keyed by selectors.
// Nice and compact at call sites.
// Example:
//   { from: {...}, "50%": {...}, to: {...} }
// ----------------------------------------------
export type KeyframesInputObject = Readonly<{
  name: KeyframesName;
  steps: Readonly<Record<KeyframeSelector, CssDeclMap>>;
}>;

// ----------------------------------------------
// Input option B: tuple list for ordered steps.
// Example:
//   [["from", {...}], ["50%", {...}], ["to", {...}]]
// ----------------------------------------------
export type KeyframesInputTuple = Readonly<{
  name: KeyframesName;
  steps: readonly (readonly [KeyframeSelector, CssDeclMap])[];
}>;

// ----------------------------------------------
// Union of accepted input shapes.
// ----------------------------------------------
export type KeyframesInput = KeyframesInputObject | KeyframesInputTuple;

// ----------------------------------------------
// Manager interface (primitive, CSS-shaped).
// ----------------------------------------------
export interface KeyframesManager {
  // Register/replace a keyframes block by name.
  set(input: KeyframesInput): void;

  // Bulk set (call onDirty once).
  setMany(inputs: readonly KeyframesInput[]): void;

  // Remove keyframes by name.
  delete(name: KeyframesName): void;

  // Queries.
  has(name: KeyframesName): boolean;
  get(name: KeyframesName): KeyframesDef | undefined;

  // Render.
  renderOne(name: KeyframesName): string;
  renderAll(): string;
}

// ----------------------------------------------
// CHANGED: internal-only helper to discriminate object vs tuple form.
// ----------------------------------------------
function isKeyframesTupleInput(x: KeyframesInput): x is KeyframesInputTuple {
  // CHANGED: tuple input has steps as an array of tuples; object input has a record.
  // We discriminate by checking whether the first entry is an array.
  const first = (x as KeyframesInputTuple).steps[0] as unknown;
  return Array.isArray(first);
}

// ----------------------------------------------
// CHANGED: internal-only helper to validate a KeyframeSelector.
// ----------------------------------------------
function assertValidSelector(at: KeyframeSelector): void {
  // CHANGED: allow from/to.
  if (at === "from" || at === "to") return;

  // CHANGED: parse "<number>%".
  const n = Number(at.slice(0, -1));

  // CHANGED: basic sanity checks.
  if (!Number.isFinite(n)) {
    throw new Error(`@keyframes: invalid selector "${at}" (not a number%).`);
  }

  // CHANGED: enforce 0–100 range (CSS effectively expects this).
  if (n < 0 || n > 100) {
    throw new Error(`@keyframes: invalid selector "${at}" (must be 0%..100%).`);
  }
}

// ----------------------------------------------
// CHANGED: internal-only helper to normalize a decl map.
// (Trim values; drop empty keys; you can get fancier later.)
// ----------------------------------------------
function normalizeDecls(decls: CssDeclMap): CssDeclMap {
  // CHANGED: create a fresh object with trimmed values.
  const out: Record<string, string> = {};

  // CHANGED: normalize entries.
  for (const [k, v] of Object.entries(decls)) {
    // CHANGED: skip empty keys.
    if (!k || k.trim() === "") continue;

    // CHANGED: keep value trimming conservative.
    const vv = String(v).trim();

    // CHANGED: allow empty string values if you want; here we drop empties.
    if (vv === "") continue;

    // CHANGED: store.
    out[k.trim()] = vv;
  }

  // CHANGED: freeze-ish via Readonly return type.
  return out;
}

// ----------------------------------------------
// CHANGED: deterministic ordering for steps.
// We put "from" first, "to" last, percentages sorted numerically.
// ----------------------------------------------
function sortSteps(steps: readonly KeyframeStep[]): KeyframeStep[] {
  // CHANGED: copy so we don’t mutate caller data.
  const copy = [...steps];

  // CHANGED: ordering function.
  copy.sort((a, b) => {
    // CHANGED: from is smallest.
    if (a.at === "from" && b.at !== "from") return -1;
    if (b.at === "from" && a.at !== "from") return 1;

    // CHANGED: to is largest.
    if (a.at === "to" && b.at !== "to") return 1;
    if (b.at === "to" && a.at !== "to") return -1;

    // CHANGED: both are percentages; compare numeric.
    const na = Number(a.at.slice(0, -1));
    const nb = Number(b.at.slice(0, -1));
    return na - nb;
  });

  // CHANGED: return sorted copy.
  return copy;
}

// ----------------------------------------------
// CHANGED: normalize inputs to canonical KeyframesDef.
// ----------------------------------------------
function normalizeKeyframesInput(input: KeyframesInput): KeyframesDef {
  // CHANGED: normalize name (trim only).
  const name: KeyframesName = input.name.trim();

  // CHANGED: basic name guard.
  if (name === "") {
    throw new Error(`@keyframes: name cannot be empty.`);
  }

  // CHANGED: build steps array.
  const steps: KeyframeStep[] = [];

  // CHANGED: tuple input path.
  if (isKeyframesTupleInput(input)) {
    for (const [at, decls] of input.steps) {
      assertValidSelector(at);
      steps.push({ at, decls: normalizeDecls(decls) });
    }
  } else {
    // CHANGED: object input path.
    for (const [atRaw, decls] of Object.entries(input.steps)) {
      const at = atRaw as KeyframeSelector;
      assertValidSelector(at);
      steps.push({ at, decls: normalizeDecls(decls) });
    }
  }

  // CHANGED: reject empty steps.
  if (steps.length === 0) {
    throw new Error(`@keyframes ${name}: must have at least one step.`);
  }

  // CHANGED: merge duplicate selectors by last-wins (simple, predictable).
  // If you prefer strictness, throw on duplicates instead.
  const byAt: Map<KeyframeSelector, KeyframeStep> = new Map();
  for (const s of steps) byAt.set(s.at, s);

  // CHANGED: deterministic ordering.
  const sorted = sortSteps(Array.from(byAt.values()));

  // CHANGED: canonical form.
  return { name, steps: sorted };
}

// ----------------------------------------------
// CHANGED: render a declaration map as CSS lines.
// This assumes you already have similar logic; feel free to reuse it.
// ----------------------------------------------
function renderDecls(decls: CssDeclMap): string[] {
  // CHANGED: stable ordering by property name.
  const keys = Object.keys(decls).sort();

  // CHANGED: render each declaration line.
  return keys.map((k) => `    ${k}: ${decls[k]};`);
}

// ----------------------------------------------
// CHANGED: render a full @keyframes block.
// ----------------------------------------------
function renderKeyframes(def: KeyframesDef): string {
  // CHANGED: start block.
  const lines: string[] = [];
  lines.push(`@keyframes ${def.name} {`);

  // CHANGED: render steps.
  for (const step of def.steps) {
    lines.push(`  ${step.at} {`);
    lines.push(...renderDecls(step.decls));
    lines.push(`  }`);
  }

  // CHANGED: end block.
  lines.push(`}`);

  // CHANGED: join.
  return lines.join("\n");
}

// ----------------------------------------------
// Factory.
// ----------------------------------------------
export function manage_keyframes(args: {
  // Called whenever keyframes change.
  onChange: () => void;
}): KeyframesManager {
  // CHANGED: storage by name.
  const byName: Map<KeyframesName, KeyframesDef> = new Map();

  return {
    set(input: KeyframesInput): void {
      // CHANGED: normalize at boundary.
      const next = normalizeKeyframesInput(input);

      // CHANGED: optional changed-detection.
      const prev = byName.get(next.name);
      const isSame = prev !== undefined && JSON.stringify(prev) === JSON.stringify(next);
      if (isSame) return;

      // CHANGED: store + dirty.
      byName.set(next.name, next);
      args.onChange();
    },

    setMany(inputs: readonly KeyframesInput[]): void {
      // CHANGED: batch normalize.
      for (const input of inputs) {
        const next = normalizeKeyframesInput(input);
        byName.set(next.name, next);
      }

      // CHANGED: dirty once.
      args.onChange();
    },

    delete(name: KeyframesName): void {
      // CHANGED: delete with trim consistency.
      const did = byName.delete(name.trim());
      if (did) args.onChange();
    },

    has(name: KeyframesName): boolean {
      return byName.has(name.trim());
    },

    get(name: KeyframesName): KeyframesDef | undefined {
      return byName.get(name.trim());
    },

    renderOne(name: KeyframesName): string {
      const def = byName.get(name.trim());
      return def ? renderKeyframes(def) : "";
    },

    renderAll(): string {
      // CHANGED: deterministic output by sorting names.
      const names = Array.from(byName.keys()).sort();

      // CHANGED: render in order.
      const blocks: string[] = [];
      for (const n of names) {
        const def = byName.get(n);
        if (def) blocks.push(renderKeyframes(def));
      }

      return blocks.join("\n\n");
    },
  };
}