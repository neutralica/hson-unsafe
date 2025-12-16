/* loop-test.rig.ts
 *
 * A “still-safe” 3-way spin rig:
 * - Core operations are in one calm object: SPINS
 * - Core loop is a small linear runRing() function
 * - Supports cw/ccw and N cycles
 * - Quiet by default; optional trace returned (no console logs)
 *
 * Requires imports in your repo:
 *   - hson
 *   - assert_invariants(root: HsonNode, fn?: string): void
 *   - compare_nodes(a: HsonNode, b: HsonNode, verbose?: boolean): string[]
 */

import { hson } from "../hson";
import { HsonNode } from "../types-consts";
import { is_Node } from "../utils/node-utils/node-guards.new";
import { assert_invariants } from "./assert-invariants.utils";
import { compare_nodes } from "./compare-nodes";


export type Fmt = "json" | "html" | "hson";
export type SourceFormat = Fmt | "auto" | "node" | "dom";
export type LoopDir = "cw" | "ccw";

export type LoopOpts = {
  times?: number;            // default 3
  dir?: LoopDir;             // default "cw"
  entry?: SourceFormat;      // default "auto"
  verbose?: boolean;         // default false; when true, include trace
  stopOnFirstFail?: boolean; // default true
};

export type Step = { step: string; ok: boolean; error?: string };

export type LoopReport = {
  ok: boolean;
  times: number;
  dir: LoopDir;
  entry: SourceFormat;
  failures: Step[];
  trace?: Step[];
  final?: { fmt: Fmt; text: string };
};

export type FixtureAtom =
  | string
  | number
  | boolean
  | null
  | object
  | HTMLElement
  | HsonNode;

/* =========================================================================
 * THE TEST CHAIN
 * =========================================================================
 */
const SPIN: Record<Fmt, { emit: (n: HsonNode) => string; parse: (s: string) => HsonNode }> = {
  json: {
    emit: (n) => hson.fromNode(n as any).toJSON().serialize(),
    parse: (s) => hson.fromJSON(s.trim()).toHSON().parse() as any,
  },
  html: {
    emit: (n) => hson.fromNode(n as any).toHTML().serialize(),
    parse: (s) => hson.fromTrustedHtml(s).toHSON().parse() as any,
  },
  hson: {
    emit: (n) => hson.fromNode(n as any).toHSON().serialize(),
    parse: (s) => hson.fromHSON(s).toHSON().parse() as any,
  },
} as const;

/* =========================================================================
 * CORE LOOP — sequential and readable
 * ========================================================================= */

type CoreOpt = {
  trace: Step[];
  failures: Step[];
  verbose: boolean;
  stopOnFirstFail: boolean;
};

function runRing(
  entryFmt: Fmt,
  entryText: string,
  dir: LoopDir,
  times: number,
  opt: CoreOpt
): { ok: boolean; final: { fmt: Fmt; text: string } } {
  // 1) enter the ring
  let node = safe_parse(entryFmt, entryText, `enter:${entryFmt}`, opt);
  if (!node) return { ok: false, final: { fmt: entryFmt, text: entryText } };

  // 2) choose direction (a visible ring order)
  const ring: readonly Fmt[] =
    dir === "cw"
      ? (["json", "html", "hson"] as const)
      : (["json", "hson", "html"] as const);

  // rotate ring so we start at entryFmt
  const path = rotate_ring(ring, entryFmt);

  let carryText = entryText;

  // 3) walk the ring: emit -> parse -> compare -> advance
  for (let cycle = 0; cycle < times; cycle++) {
    step_ok(opt, `cycle ${cycle + 1}/${times} begin`);

    for (let i = 0; i < path.length; i++) {
      const fmt = path[i];

      const text = safe_emit(fmt, node, `emit:${fmt}`, opt);
      if (text === undefined) return { ok: false, final: { fmt: entryFmt, text: carryText } };

      const next = safe_parse(fmt, text, `parse:${fmt}`, opt);
      if (!next) return { ok: false, final: { fmt: entryFmt, text: carryText } };

      // CHANGED: compare_nodes returns string[] diffs (per your docs)
      const diffs = compare_nodes(node, next, false);
      if (diffs.length) {
        step_fail(opt, `cmp:node -> ${fmt} -> node`, diffs[0]);
        if (opt.stopOnFirstFail) return { ok: false, final: { fmt: entryFmt, text: carryText } };
      } else {
        step_ok(opt, `cmp:node -> ${fmt} -> node`);
      }

      node = next;
      carryText = text;
    }

    // 4) closure check: return to entry representation and re-parse once
    const closeText = safe_emit(entryFmt, node, `emit:closure:${entryFmt}`, opt);
    if (closeText !== undefined) {
      const closeNode = safe_parse(entryFmt, closeText, `parse:closure:${entryFmt}`, opt);
      if (closeNode) {
        const closeDiffs = compare_nodes(node, closeNode, false);
        if (closeDiffs.length) {
          step_fail(opt, `closure:${entryFmt}`, closeDiffs[0]);
          if (opt.stopOnFirstFail) return { ok: false, final: { fmt: entryFmt, text: carryText } };
        } else {
          step_ok(opt, `closure:${entryFmt}`);
        }
        node = closeNode;
        carryText = closeText;
      }
    }

    step_ok(opt, `cycle ${cycle + 1}/${times} end`);
  }

  return { ok: opt.failures.length === 0, final: { fmt: entryFmt, text: carryText } };
}

/* =========================================================================
 * PUBLIC ENTRY
 * ========================================================================= */

export function _test_full_loop(atom: FixtureAtom, opts: LoopOpts = {}): LoopReport {
  const trace: Step[] = [];
  const failures: Step[] = [];

  const core: CoreOpt = {
    trace,
    failures,
    verbose: !!opts.verbose,
    stopOnFirstFail: opts.stopOnFirstFail ?? true,
  };

  const times = clamp_int(opts.times ?? 3, 1, 10_000);
  const dir: LoopDir = opts.dir ?? "cw";

  const entry = (opts.entry ?? "auto") as SourceFormat;
  const resolved = resolve_entry(atom, entry, core);
  if (!resolved) return finalize(false, times, dir, entry, core, undefined);

  const { fmt, text } = resolved;

  const res = runRing(fmt, text, dir, times, core);
  return finalize(res.ok, times, dir, entry, core, res.final);
}

/* =========================================================================
 * HELPERS (below the ritual)
 * ========================================================================= */

function resolve_entry(
  atom: FixtureAtom,
  entry: SourceFormat,
  opt: CoreOpt
): { fmt: Fmt; text: string } | undefined {
  if (entry !== "auto") return coerce_entry(atom, entry, opt);

  // auto: try parse in order (json -> html -> hson), since HSON may start with "<"
  if (is_Node(atom)) {
    const text = safe_emit("hson", atom, "emit:node->hson(entry)", opt);
    if (text === undefined) return undefined;
    return { fmt: "hson", text };
  }

  if (is_html_element(atom)) {
    return { fmt: "html", text: atom.outerHTML };
  }

  if (typeof atom !== "string") {
    return { fmt: "json", text: JSON.stringify(atom) };
  }

  const s = atom.trim();

  try {
    const n = SPIN.json.parse(s);
    assert_invariants(n, "auto:json");
    return { fmt: "json", text: s };
  } catch { /* ignore */ }

  try {
    const n = SPIN.html.parse(s);
    assert_invariants(n, "auto:html");
    return { fmt: "html", text: s };
  } catch { /* ignore */ }

  try {
    const n = SPIN.hson.parse(s);
    assert_invariants(n, "auto:hson");
    return { fmt: "hson", text: s };
  } catch { /* ignore */ }

  step_fail(opt, "resolve_entry:auto", "Could not detect entry format via try-parse (json/html/hson)");
  return undefined;
}

function coerce_entry(
  atom: FixtureAtom,
  entry: SourceFormat,
  opt: CoreOpt
): { fmt: Fmt; text: string } | undefined {
  if (entry === "json") {
    const text = typeof atom === "string" ? atom : JSON.stringify(atom);
    return { fmt: "json", text };
  }

  if (entry === "html") {
    if (typeof atom === "string") return { fmt: "html", text: atom };
    if (is_html_element(atom)) return { fmt: "html", text: atom.outerHTML };
    step_fail(opt, "resolve_entry:html", "Non-string/non-HTMLElement provided for html entry");
    return undefined;
  }

  if (entry === "hson") {
    if (typeof atom === "string") return { fmt: "hson", text: atom };
    step_fail(opt, "resolve_entry:hson", "Non-string provided for hson entry");
    return undefined;
  }

  if (entry === "node") {
    if (!is_Node(atom)) {
      step_fail(opt, "resolve_entry:node", "Non-HsonNode provided for node entry");
      return undefined;
    }
    const text = safe_emit("hson", atom, "emit:node->hson(entry)", opt);
    if (text === undefined) return undefined;
    return { fmt: "hson", text };
  }

  if (entry === "dom") {
    if (!is_html_element(atom)) {
      step_fail(opt, "resolve_entry:dom", "Non-HTMLElement provided for dom entry");
      return undefined;
    }
    return { fmt: "html", text: atom.outerHTML };
  }

  step_fail(opt, "resolve_entry", `Unsupported entry: ${String(entry)}`);
  return undefined;
}

function safe_emit(fmt: Fmt, node: HsonNode, stepName: string, opt: CoreOpt): string | undefined {
  try {
    const s = SPIN[fmt].emit(node);
    step_ok(opt, stepName);
    return s;
  } catch (err) {
    step_fail(opt, stepName, err_to_string(err));
    return undefined;
  }
}

function safe_parse(fmt: Fmt, text: string, stepName: string, opt: CoreOpt): HsonNode | undefined {
  try {
    const n = SPIN[fmt].parse(text);
    assert_invariants(n, `loop_test:${fmt}`);
    step_ok(opt, stepName);
    return n;
  } catch (err) {
    step_fail(opt, stepName, err_to_string(err));
    return undefined;
  }
}

function rotate_ring(ring: readonly Fmt[], entry: Fmt): readonly Fmt[] {
  const idx = ring.indexOf(entry);
  if (idx < 0) return ring;
  return [...ring.slice(idx), ...ring.slice(0, idx)];
}

function step_ok(opt: CoreOpt, step: string): void {
  // quiet by default; only include trace when verbose=true
  if (opt.verbose) opt.trace.push({ step, ok: true });
}

function step_fail(opt: CoreOpt, step: string, error: string): void {
  opt.failures.push({ step, ok: false, error });
  if (opt.verbose) opt.trace.push({ step, ok: false, error });
}

function finalize(
  ok: boolean,
  times: number,
  dir: LoopDir,
  entry: SourceFormat,
  opt: CoreOpt,
  final?: { fmt: Fmt; text: string }
): LoopReport {
  return {
    ok,
    times,
    dir,
    entry,
    failures: opt.failures,
    trace: opt.verbose ? opt.trace : undefined,
    final,
  };
}

function clamp_int(n: number, min: number, max: number): number {
  const x = Math.trunc(n);
  if (Number.isNaN(x)) return min;
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

function err_to_string(err: unknown): string {
  if (err instanceof Error) return err.message || String(err);
  return String(err);
}


function is_html_element(x: unknown): x is HTMLElement {
  // CHANGED: avoid relying on HTMLElement existing in Node unless provided by happy-dom
  const g: any = globalThis as any;
  const H = g.HTMLElement;
  return typeof H === "function" && x instanceof H;
}