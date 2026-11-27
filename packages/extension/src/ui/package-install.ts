// Installing the ticked updates, as the UI keeps it (updates plan, phase 3):
// the run in install order (systems, then what others need), each
// package's state as the page world reports it, then a summary. A download
// the server refused (401 or 403) is remembered at that version, so it isn't
// ticked again until a newer one is out (phase 5).
import { installOrder, readyIds } from "@stagehand/shared/updates/model";
import type { InstallEvent } from "../page-package-install.ts";
import { rowsFor, updatesInput } from "./model/package-updates.ts";
import type { PageBridge } from "./page.ts";
import type {
  InstallRun,
  InstallSummary,
  InstallView,
  Store,
  UiState,
} from "./store.ts";

export interface InstallDeps {
  readonly store: Store;
  readonly page: Pick<PageBridge, "packageInstall" | "subscribe">;
  readonly markRefused: (id: string, version: string | null) => Promise<void>;
}

const REFUSED: ReadonlySet<number> = new Set([401, 403]);

const setInstall = (
  store: Store,
  fn: (i: InstallView) => InstallView,
): void => {
  store.set((s) => ({ install: fn(s.install) }));
};

/** The ticked rows: the owner's, or every Ready update until they tick. */
export function tickedIds(
  state: Pick<UiState, "data" | "check" | "install">,
): string[] {
  const open = new Set(
    rowsFor(state)
      .filter((r) => r.section === "ready" || r.section === "attention")
      .map((r) => r.id),
  );
  const ticks = state.install.ticks ?? readyIds(updatesInput(state));
  return ticks.filter((id) => open.has(id));
}

export function setTicks(store: Store, ids: readonly string[]): void {
  setInstall(store, (i) => ({ ...i, ticks: [...ids] }));
}

export function setBackup(store: Store, on: boolean): void {
  setInstall(store, (i) => ({ ...i, backup: on }));
}

/** Starts installing these updates, unless a run is going. */
export function startInstall(deps: InstallDeps, ids: readonly string[]): void {
  const state = deps.store.get();
  if (state.install.running || !ids.length) return;
  const rows = rowsFor(state);
  const order = installOrder(updatesInput(state), ids).filter((id) =>
    rows.some((r) => r.id === id),
  );
  const items = order.map((id) => ({
    type: rows.find((r) => r.id === id)?.type ?? "module",
    id,
  }));
  const backup = state.install.backup;
  const requestId = deps.page.packageInstall(items, backup);
  const versions = Object.fromEntries(
    order.map((id) => {
      const r = rows.find((x) => x.id === id);
      return [id, { from: r?.from ?? "", to: r?.to ?? "" }];
    }),
  );
  const run: InstallRun = {
    requestId,
    ids: order,
    backup,
    states: Object.fromEntries(order.map((id) => [id, "queued" as const])),
    versions,
    errors: {},
  };
  setInstall(deps.store, (i) => ({ ...i, running: run, last: null }));
}

function summaryOf(state: UiState, run: InstallRun): InstallSummary {
  const setup = state.data.setup;
  const known = [
    ...(setup?.modules ?? []).map((m) => ({ ...m, type: "module" as const })),
    ...(setup?.systems ?? []).map((s) => ({ ...s, type: "system" as const })),
  ];
  return {
    ok: run.ids
      .filter((id) => run.states[id] === "done")
      .map((id) => {
        const pkg = known.find((p) => p.id === id);
        return {
          id,
          title: pkg?.title ?? id,
          type: pkg?.type ?? "module",
          ...(run.versions[id] ?? { from: "", to: "" }),
        };
      }),
    failed: run.ids
      .filter((id) => run.states[id] === "failed")
      .map((id) => ({ id, ...run.errors[id] })),
    backups: run.backup,
  };
}

function onEvent(deps: InstallDeps, e: InstallEvent): void {
  const { store } = deps;
  const run = store.get().install.running;
  if (run?.requestId !== e.requestId) return;
  if (e.kind === "item") {
    const error = {
      ...(e.error ? { error: e.error } : {}),
      ...(e.errorCode ? { errorCode: e.errorCode } : {}),
    };
    setInstall(store, (i) =>
      i.running
        ? {
            ...i,
            running: {
              ...i.running,
              states: { ...i.running.states, [e.id]: e.state },
              errors:
                e.state === "failed"
                  ? { ...i.running.errors, [e.id]: error }
                  : i.running.errors,
            },
          }
        : i,
    );
    const to = run.versions[e.id]?.to;
    if (e.state === "failed" && e.errorCode && REFUSED.has(e.errorCode) && to)
      void deps.markRefused(e.id, to);
    return;
  }
  const last = summaryOf(store.get(), store.get().install.running ?? run);
  setInstall(store, (i) => ({ ...i, running: null, last, ticks: null }));
}

/** Follows our installs' events; returns a function that stops following. */
export function trackInstalls(deps: InstallDeps): () => void {
  return deps.page.subscribe((m) => {
    if (m.type === "PACKAGE_INSTALL") onEvent(deps, m.payload);
  });
}

/** How far the run is: the package being installed now, counting from one. */
export function runPosition(run: InstallRun): { at: number; total: number } {
  const finished = run.ids.filter(
    (id) => run.states[id] === "done" || run.states[id] === "failed",
  ).length;
  return { at: Math.min(finished + 1, run.ids.length), total: run.ids.length };
}

/** A package waiting in the run, or being backed up, before its install. */
export function waitingIn(
  state: Pick<UiState, "install">,
  id: string,
): "queued" | "backup" | undefined {
  const s = state.install.running?.states[id];
  return s === "queued" || s === "backup" ? s : undefined;
}
