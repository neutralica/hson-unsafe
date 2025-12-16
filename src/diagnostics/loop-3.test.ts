// loop-3.test.ts

/**
 * A deterministic 3-way round-trip validation rig for HSON.
 *
 * This module exercises the full serialization ring:
 *   JSON ↔ HTML ↔ HSON
 *
 * The goal is to detect structural drift by repeatedly:
 *   1) serializing a canonical HsonNode into another format,
 *   2) parsing it back into a HsonNode,
 *   3) asserting invariants,
 *   4) diffing the result against the prior node.
 *
 * The loop is intentionally linear, explicit, and side-effect free.
 * There is no logging; all results are returned as structured data.
 */

import { hson } from "../hson";
import { HsonNode } from "../types-consts";
import { is_Node } from "../utils/node-utils/node-guards.new";
import { assert_invariants } from "./assert-invariants.test";
import { compare_nodes } from "./compare-nodes.test";

/* ============================================================================
 * Public types
 * ========================================================================== */

export type Fmt = "json" | "html" | "hson";
export type SourceFormat = Fmt | "auto" | "node" | "dom";
export type LoopDir = "cw" | "ccw";

export type LoopOpts = {
  times?: number;            // default 3
  dir?: LoopDir;             // default "cw"
  entry?: SourceFormat;      // default "auto"
  verbose?: boolean;         // include step trace
  stopOnFirstFail?: boolean; // default true
  capture?: boolean;         // capture serialized artifacts
};

export type Step = {
  step: string;
  ok: boolean;
  error?: string;
};

export type Artifact = {
  lap: number;   // 1-based
  fmt: Fmt;
  stage: "emit" | "closure";
  text: string;
};

export type LoopReport = {
  ok: boolean;
  times: number;
  dir: LoopDir;
  entry: SourceFormat;

  final?: { fmt: Fmt; text: string };

  failures?: Step[];
  trace?: Step[];
  artifacts?: Artifact[];
};

export type FixtureAtom =
  | string
  | number
  | boolean
  | null
  | object
  | HTMLElement
  | HsonNode;

/* ============================================================================
 * Serialization ring
 * ========================================================================== */

const SPIN: Record<Fmt, {
  emit: (n: HsonNode) => string;
  parse: (s: string) => HsonNode;
}> = {
  json: {
    emit: (n) => hson.fromNode(n).toJSON().serialize(),
    parse: (s) => hson.fromJSON(s.trim()).toHSON().parse() as HsonNode,
  },
  html: {
    emit: (n) => hson.fromNode(n).toHTML().serialize(),
    parse: (s) => hson.fromTrustedHtml(s).toHSON().parse() as HsonNode,
  },
  hson: {
    emit: (n) => hson.fromNode(n).toHSON().serialize(),
    parse: (s) => hson.fromHSON(s).toHSON().parse() as HsonNode,
  },
} as const;

/* ============================================================================
 * Core loop
 * ========================================================================== */

type CoreOpt = {
  trace: Step[];
  failures: Step[];
  verbose: boolean;
  stopOnFirstFail: boolean;
  capture?: { artifacts: Artifact[] };
};

function runRing(
  entryFmt: Fmt,
  entryText: string,
  dir: LoopDir,
  times: number,
  opt: CoreOpt
): { ok: boolean; final: { fmt: Fmt; text: string } } {

  let node = safe_parse(entryFmt, entryText, `enter:${entryFmt}`, opt);
  if (!node) {
    return { ok: false, final: { fmt: entryFmt, text: entryText } };
  }

  const ring: readonly Fmt[] =
    dir === "cw"
      ? ["json", "html", "hson"]
      : ["json", "hson", "html"];

  const path = rotate_ring(ring, entryFmt);

  let carryText = entryText;
  let carryFmt: Fmt = entryFmt;

  for (let lap = 0; lap < times; lap++) {
    const lapNo = lap + 1;
    step_ok(opt, `lap ${lapNo}/${times} begin`);

    for (const fmt of path) {
      const text = safe_emit(fmt, node, `emit:${fmt}`, opt);
      if (text === undefined) {
        return { ok: false, final: { fmt: carryFmt, text: carryText } };
      }

      opt.capture?.artifacts.push({
        lap: lapNo,
        fmt,
        stage: "emit",
        text,
      });

      const next = safe_parse(fmt, text, `parse:${fmt}`, opt);
      if (!next) {
        return { ok: false, final: { fmt: carryFmt, text: carryText } };
      }

      const diffs = compare_nodes(node, next, false);
      if (diffs.length) {
        step_fail(opt, `cmp:node -> ${fmt} -> node`, diffs[0]);
        if (opt.stopOnFirstFail) {
          return { ok: false, final: { fmt: carryFmt, text: carryText } };
        }
      } else {
        step_ok(opt, `cmp:node -> ${fmt} -> node`);
      }

      node = next;
      carryText = text;
      carryFmt = fmt;
    }

    const closeText = safe_emit(entryFmt, node, `closure:emit:${entryFmt}`, opt);
    if (closeText !== undefined) {
      opt.capture?.artifacts.push({
        lap: lapNo,
        fmt: entryFmt,
        stage: "closure",
        text: closeText,
      });

      const closeNode = safe_parse(entryFmt, closeText, `closure:parse:${entryFmt}`, opt);
      if (closeNode) {
        const diffs = compare_nodes(node, closeNode, false);
        if (diffs.length) {
          step_fail(opt, `closure:cmp:${entryFmt}`, diffs[0]);
          if (opt.stopOnFirstFail) {
            return { ok: false, final: { fmt: carryFmt, text: carryText } };
          }
        } else {
          step_ok(opt, `closure:cmp:${entryFmt}`);
        }

        node = closeNode;
        carryText = closeText;
        carryFmt = entryFmt;
      }
    }

    step_ok(opt, `lap ${lapNo}/${times} end`);
  }

  return {
    ok: opt.failures.length === 0,
    final: { fmt: carryFmt, text: carryText },
  };
}

/* ============================================================================
 * Public entry
 * ========================================================================== */

export function _test_full_loop(
  atom: FixtureAtom,
  opts: LoopOpts = {}
): LoopReport {

  const trace: Step[] = [];
  const failures: Step[] = [];
  const artifacts: Artifact[] = [];

  const core: CoreOpt = {
    trace,
    failures,
    verbose: !!opts.verbose,
    stopOnFirstFail: opts.stopOnFirstFail ?? true,
    capture: opts.capture ? { artifacts } : undefined,
  };

  const times = clamp_int(opts.times ?? 3, 1, 10_000);
  const dir: LoopDir = opts.dir ?? "cw";
  const entry = (opts.entry ?? "auto") as SourceFormat;

  const resolved = resolve_entry(atom, entry, core);
  if (!resolved) {
    return finalize(false, times, dir, entry, core, undefined);
  }

  const { fmt, text } = resolved;
  const res = runRing(fmt, text, dir, times, core);

  return finalize(res.ok, times, dir, entry, core, res.final);
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

function resolve_entry(
  atom: FixtureAtom,
  entry: SourceFormat,
  opt: CoreOpt
): { fmt: Fmt; text: string } | undefined {

  if (entry !== "auto") {
    return coerce_entry(atom, entry, opt);
  }

  if (is_Node(atom)) {
    const text = safe_emit("hson", atom, "emit:node->hson(entry)", opt);
    return text ? { fmt: "hson", text } : undefined;
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
  } catch {}

  try {
    const n = SPIN.html.parse(s);
    assert_invariants(n, "auto:html");
    return { fmt: "html", text: s };
  } catch {}

  try {
    const n = SPIN.hson.parse(s);
    assert_invariants(n, "auto:hson");
    return { fmt: "hson", text: s };
  } catch {}

  step_fail(opt, "resolve_entry:auto", "Could not detect entry format");
  return undefined;
}

function coerce_entry(
  atom: FixtureAtom,
  entry: SourceFormat,
  opt: CoreOpt
): { fmt: Fmt; text: string } | undefined {

  if (entry === "json") {
    return { fmt: "json", text: typeof atom === "string" ? atom : JSON.stringify(atom) };
  }

  if (entry === "html") {
    if (typeof atom === "string") return { fmt: "html", text: atom };
    if (is_html_element(atom)) return { fmt: "html", text: atom.outerHTML };
    step_fail(opt, "resolve_entry:html", "Invalid html entry");
    return undefined;
  }

  if (entry === "hson") {
    if (typeof atom === "string") return { fmt: "hson", text: atom };
    step_fail(opt, "resolve_entry:hson", "Invalid hson entry");
    return undefined;
  }

  if (entry === "node") {
    if (!is_Node(atom)) {
      step_fail(opt, "resolve_entry:node", "Invalid node entry");
      return undefined;
    }
    const text = safe_emit("hson", atom, "emit:node->hson(entry)", opt);
    return text ? { fmt: "hson", text } : undefined;
  }

  if (entry === "dom") {
    if (!is_html_element(atom)) {
      step_fail(opt, "resolve_entry:dom", "Invalid dom entry");
      return undefined;
    }
    return { fmt: "html", text: atom.outerHTML };
  }

  step_fail(opt, "resolve_entry", `Unsupported entry: ${entry}`);
  return undefined;
}

function safe_emit(fmt: Fmt, node: HsonNode, step: string, opt: CoreOpt): string | undefined {
  try {
    const s = SPIN[fmt].emit(node);
    step_ok(opt, step);
    return s;
  } catch (err) {
    step_fail(opt, step, err_to_string(err));
    return undefined;
  }
}

function safe_parse(fmt: Fmt, text: string, step: string, opt: CoreOpt): HsonNode | undefined {
  try {
    const n = SPIN[fmt].parse(text);
    assert_invariants(n, `loop:${fmt}`);
    step_ok(opt, step);
    return n;
  } catch (err) {
    step_fail(opt, step, err_to_string(err));
    return undefined;
  }
}

function rotate_ring(ring: readonly Fmt[], entry: Fmt): readonly Fmt[] {
  const i = ring.indexOf(entry);
  return i < 0 ? ring : [...ring.slice(i), ...ring.slice(0, i)];
}

function step_ok(opt: CoreOpt, step: string): void {
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

  const report: LoopReport = {
    ok,
    times,
    dir,
    entry,
    final,
  };

  if (opt.failures.length) report.failures = opt.failures;
  if (opt.verbose) report.trace = opt.trace;
  if (opt.capture) report.artifacts = opt.capture.artifacts;

  return report;
}

function clamp_int(n: number, min: number, max: number): number {
  const x = Math.trunc(n);
  return Number.isNaN(x) ? min : Math.min(max, Math.max(min, x));
}

function err_to_string(err: unknown): string {
  return err instanceof Error ? err.message || String(err) : String(err);
}

function is_html_element(x: unknown): x is HTMLElement {
  const H = (globalThis as any).HTMLElement;
  return typeof H === "function" && x instanceof H;
}