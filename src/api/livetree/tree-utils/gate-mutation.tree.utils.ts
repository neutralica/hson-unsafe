// src/api/livetree/tree-utils/gate-mutation.tree.utils.ts

// make the origin token explicit and readonly
export type OriginTag = Readonly<{ id: string }>;

export type GateObserver = (
    records: readonly MutationRecord[],
    origin: OriginTag | null
) => void;

// exported interface for clarity and typing at call sites
export interface MutationGate {
    // All DOM writes must go through here
    write(fn: (origin: OriginTag) => void): void;

    // Subscribe to mutations; returns an unsubscriber
    observe(cb: GateObserver): () => void;
}

// implement subscriber list instead of free `observerFn`
export function createMutationGate(target: Node): MutationGate {
    // keep a list of observers; no global `observerFn`
    const observers: GateObserver[] = [];

    // Tracks origin of the *current* gated write batch
    let currentOrigin: OriginTag | null = null;

    // single MutationObserver dispatching to all subscribers
    const mutationObserver: MutationObserver = new MutationObserver(
        (records: MutationRecord[]): void => {
            // Capture and clear the origin for this batch
            const origin: OriginTag | null = currentOrigin;
            currentOrigin = null;

            // Notify subscribers; readonly array passed through
            for (let i = 0; i < observers.length; i++) {
                // NOTE: do not catch here; let errors surface in dev
                observers[i](records, origin);
            }
        }
    );

    // Start observing the whole subtree
    mutationObserver.observe(target, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
    });

    // safe UUID fallback for older environments
    function newOriginId(): string {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        // Low-collision fallback; still unique enough as an origin tag
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    // All writes must go through this gate
    function write(fn: (origin: OriginTag) => void): void {
        const origin: OriginTag = { id: newOriginId() };
        currentOrigin = origin;

        try {
            fn(origin);
        } finally {
            // if no mutations occurred (observer won’t run), clear origin soon
            // This prevents a stale origin from leaking into later, unrelated mutations.
            queueMicrotask((): void => {
                if (currentOrigin === origin) {
                    currentOrigin = null;
                }
            });
        }
    }

    // Subscribe; returns an unsubscriber
    function observe(cb: GateObserver): () => void {
        observers.push(cb);
        let active: boolean = true;

        // return an idempotent unsubscriber
        return (): void => {
            if (!active) return;
            active = false;
            const idx: number = observers.indexOf(cb);
            if (idx >= 0) observers.splice(idx, 1);
        };
    }

    return { write, observe };
}
