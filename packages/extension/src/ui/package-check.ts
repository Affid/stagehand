// Our own check of the server's packages, as the UI keeps it (updates plan,
// phase 2): a check of the library (one at a time) or of single packages;
// progress and results go into the store as they come; at the end the
// results are saved per server by the background (UpdatesRecord), so the
// next Setup visit starts from them.
import type { PackageCheck } from "@stagehand/shared/updates/check";
import type { PackageKind } from "../page-protocol.ts";
import type { CheckEvent } from "../page-package-check.ts";
import type { PageBridge } from "./page.ts";
import type { CheckView, Store } from "./store.ts";

export interface CheckDeps {
  readonly store: Store;
  readonly page: Pick<
    PageBridge,
    "packageCheck" | "stopPackageCheck" | "subscribe"
  >;
  /** Saves results: a full check replaces the last one, else they merge in. */
  readonly save: (
    full: boolean,
    checkedAt: number,
    results: readonly PackageCheck[],
  ) => Promise<void>;
  readonly now?: () => number;
}

const setCheck = (store: Store, fn: (c: CheckView) => CheckView): void => {
  store.set((s) => ({ check: fn(s.check) }));
};

/** Checks the whole library, unless a check of it is running. */
export function checkAll(deps: CheckDeps): void {
  if (deps.store.get().check.running) return;
  const requestId = deps.page.packageCheck({ op: "all" });
  setCheck(deps.store, (c) => ({
    ...c,
    running: { requestId, done: 0, total: 0 },
    live: {},
  }));
}

/** Checks one package on its own. */
export function checkOne(deps: CheckDeps, type: PackageKind, id: string): void {
  if (Object.values(deps.store.get().check.one).includes(id)) return;
  const requestId = deps.page.packageCheck({ op: "one", type, id });
  setCheck(deps.store, (c) => ({ ...c, one: { ...c.one, [requestId]: id } }));
}

/** Stops the check of the library: what came in so far is kept. */
export function stopCheck(deps: CheckDeps): void {
  const running = deps.store.get().check.running;
  if (running) deps.page.stopPackageCheck(running.requestId);
}

function onFullRun(deps: CheckDeps, e: CheckEvent): void {
  const { store } = deps;
  if (e.kind === "tick") {
    setCheck(store, (c) =>
      c.running
        ? {
            ...c,
            running: {
              requestId: e.requestId,
              done: e.done,
              total: e.total,
              ...(e.current ? { current: e.current } : {}),
            },
          }
        : c,
    );
    return;
  }
  if (e.kind === "result") {
    setCheck(store, (c) => ({
      ...c,
      live: { ...c.live, [e.result.id]: e.result },
    }));
    return;
  }
  const results = Object.values(store.get().check.live);
  const full = !e.stopped && !e.error;
  void deps.save(full, (deps.now ?? Date.now)(), results).finally(() => {
    setCheck(store, (c) => ({ ...c, running: null, live: {} }));
  });
}

const without = <T>(
  r: Readonly<Record<string, T>>,
  key: string,
): Record<string, T> =>
  Object.fromEntries(Object.entries(r).filter(([k]) => k !== key));

function onOneRun(deps: CheckDeps, e: CheckEvent): void {
  const { store } = deps;
  if (e.kind === "result") {
    const { id, state } = e.result;
    setCheck(store, (c) => ({
      ...c,
      live: { ...c.live, [id]: e.result },
      // A failed check that fails again says so (phase 5).
      tries:
        state === "error"
          ? { ...c.tries, [id]: (c.tries?.[id] ?? 1) + 1 }
          : without(c.tries ?? {}, id),
    }));
    void deps.save(false, (deps.now ?? Date.now)(), [e.result]);
    return;
  }
  if (e.kind !== "done") return;
  setCheck(store, (c) => {
    const id = c.one[e.requestId];
    if (id === undefined) return c;
    return {
      ...c,
      one: without(c.one, e.requestId),
      live: c.running ? c.live : without(c.live, id),
    };
  });
}

/** Follows our checks' events; returns a function that stops following. */
export function trackChecks(deps: CheckDeps): () => void {
  return deps.page.subscribe((m) => {
    if (m.type !== "PACKAGE_CHECK") return;
    const e = m.payload;
    const c = deps.store.get().check;
    if (c.running?.requestId === e.requestId) onFullRun(deps, e);
    else if (e.requestId in c.one) onOneRun(deps, e);
  });
}
