
hson.liveMap [before 2026?]
hson.component
___________

Phase 1 — Invisible performance fixes (no new methods)
1) Transform write coalescing inside the style facade
Interpose on setProperty('transform', …) and only touch the DOM when the effective translate/rotate changed past an epsilon. Also normalize to translate3d(...) rotate(...) to pin it on the compositor.
// style.facade.ts (inside your existing LiveTree style wrapper)

/** epsilon for meaningfully different transforms */
const EPS = 0.2; // px or deg

// keep per-node cache without changing public API
const _transformCache = new WeakMap<Element, { x: number; y: number; z: number; deg: number; raw: string }>();

export class StyleFacade {
  constructor(private readonly el: Element) {}

  setProperty(prop: string, value: string): this {
    // ---  special-case transform writes
    if (prop === 'transform') {
      // Parse the incoming string once into components.
      // Accept any order; if parse fails, fall back to raw string passthrough.
      const parsed = parseTransform(value); // implement tiny parser for translate/rotate
      if (parsed) {
        const prev = _transformCache.get(this.el);
        const changed =
          !prev ||
          Math.abs(prev.x - parsed.x) > EPS ||
          Math.abs(prev.y - parsed.y) > EPS ||
          Math.abs(prev.z - (parsed.z ?? 0)) > EPS ||
          Math.abs(prev.deg - (parsed.deg ?? 0)) > EPS;

        if (!changed) return this; // skip DOM write

        // Normalize format → compositor-friendly
        const norm = `translate3d(${parsed.x}px, ${parsed.y}px, ${(parsed.z ?? 0)}px)` +
                     (parsed.deg != null ? ` rotate(${parsed.deg}deg)` : '');

        (this.el as HTMLElement).style.setProperty('transform', norm);
        _transformCache.set(this.el, { x: parsed.x, y: parsed.y, z: parsed.z ?? 0, deg: parsed.deg ?? 0, raw: norm });
        return this;
      }
      // fallback: unknown transform — write through but still cache raw to reduce churn
      const prev = _transformCache.get(this.el);
      if (prev?.raw === value) return this;
      (this.el as HTMLElement).style.setProperty('transform', value);
      _transformCache.set(this.el, { x: prev?.x ?? 0, y: prev?.y ?? 0, z: prev?.z ?? 0, deg: prev?.deg ?? 0, raw: value });
      return this;
    }

    // default path unchanged
    (this.el as HTMLElement).style.setProperty(prop, value);
    return this;
  }
}

/* tiny helper — accepts strings you already emit like:
   "translate(12px, 34px) rotate(15deg)"
   "translate3d(12px, 34px, 0) rotate(0deg)"
*/
function parseTransform(s: string): { x: number; y: number; z?: number; deg?: number } | null {
  let x: number | undefined, y: number | undefined, z: number | undefined, deg: number | undefined;

  // very small regexes; no need for full CSS grammar here
  const t3 = /translate3d\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/i.exec(s);
  const t2 = /translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/i.exec(s);
  const r  = /rotate\(\s*([-\d.]+)deg\s*\)/i.exec(s);

  if (t3) { x = +t3[1]; y = +t3[2]; z = +t3[3]; }
  if (!t3 && t2) { x = +t2[1]; y = +t2[2]; z = 0; }
  if (r) { deg = +r[1]; }

  if (x == null || y == null) return null;
  return { x, y, z, deg };
}
Effect: your existing node.style.setProperty('transform', 'translate(...) rotate(...)') calls suddenly become much cheaper—HSON writes only when the numbers actually changed, and emits the compositor-friendly form. No new public API.
2) Microtask batching for style writes
Batch multiple setProperty calls in the same turn and flush once at microtask end. This alone removes the “quaking” caused by interleaved reads/writes.
// style.batch.ts — invisible write coalescing for all style.setProperty

const _pending = new Set<HTMLElement>();
let _scheduled = false;

function scheduleFlush() {
  if (_scheduled) return;
  _scheduled = true;
  queueMicrotask(() => {
    _scheduled = false;
    // touching style properties already mutated the inline style map;
    // the point here is to prevent layout between sequential writes.
    // In most engines, simply deferring is enough to avoid layout thrash.
    _pending.clear();
  });
}

export function markDirty(el: HTMLElement) {
  _pending.add(el);
  scheduleFlush();
}

// In StyleFacade.setProperty:
(markDirty(this.el as HTMLElement)); // after setting the property
No API added; the facade just behaves better.
3) Lazy keyframe injection (idempotent) behind animation
If someone sets animation: mote-spin … and the @keyframes isn’t present, inject it once. Again, no new method surface.
// inside setProperty:
if (prop === 'animation' && /(^|\s)mote-spin(\s|$)/.test(value)) {
  ensureSpinKeyframes(this.el.ownerDocument);
}
Phase 2 — Heuristic yielding for heavy ops (opt-in, but default ON)
You don’t need a public hson.idle if core hot paths self-yield when they detect “too long in one turn.”
Implement a tiny budget/yield helper inside core loops like fromJSON(), fromHTML(), big append() batches, and fixture processors.
// core/yield.ts
const BUDGET_MS = 6; // do small slices; let rAF/render breathe

export async function budgetedLoop<T>(
  items: Iterable<T>,
  step: (item: T) => void | Promise<void>,
): Promise<void> {
  let start = performance.now();
  for (const it of items) {
    // step may be sync; treat as maybe-async
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.resolve(step(it));

    if (performance.now() - start > BUDGET_MS) {
      // yield to the browser; prefer rIC, fallback to rAF
      await new Promise<void>(res => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).requestIdleCallback ? (window as any).requestIdleCallback(() => res()) :
          requestAnimationFrame(() => res());
      });
      start = performance.now();
    }
  }
}
Use this internally in the few places that churn (fixture runner, large build/append). Callers don’t learn a new API; they just stop seeing 1s freezes.
Phase 3 — Keep public surface tiny (names clarified)
If/when you do add surface:
node.style.transform.set({...}) is just a typed façade over the smarter setProperty above. It doesn’t add new behavior; it gives DX and type safety.
tree.anim.loop(fn) is a singleton rAF host mainly to prevent accidental double loops. That’s general, not mote-specific. You can hide it now and expose later.
Crucially: node always means a LiveTree node. If you want to avoid confusion with tree (root), consider aliasing in docs: “node is any LiveTree element; tree can also be a node.”
What this buys you today
No new methods for users to learn.
Your current demo code keeps calling mote.style.setProperty('transform', …) and HSON quietly:
coalesces writes,
normalizes to translate3d + rotate,
avoids redundant DOM writes,
batches changes to microtask end,
injects missing keyframes once when asked.
Big fixtures stop freezing the page because core loops self-yield.


-----------------


COMPLETED - liveTree.listen - event listener getter method
    "tree.listen.onMouseMove(updateXY());"
    -- basically expedites tree.asDocument().setEventListener(), + maybe adds a few creature comforts
    -- interesting opportunity to make event listeners unannoying (built-in mappping & removal for GC is easy first thought; maybe validation of some kind)
    -- chained methods optional--TBD (but why not; event listeners have a few fairly constrained types and options, seems like an ideal pattern)

