// Foundry's running tasks (backups, restores, snapshots, updates), its busy
// lock and the updates it would install, as the page world forwards them
// (page-progress.ts, page-updates.ts). Kept in the store, so they survive
// switching pages.
import { ENDS, type Lock, type Progress } from "../page-progress.ts";
import type { PageBridge } from "./page.ts";
import type { Store, UiState } from "./store.ts";

export const UNLOCKED: Lock = { locked: false };

/** At most this many tasks at once, as Foundry's own progress bars. */
const MAX_TASKS = 20;

function withTick(
  tasks: readonly Progress[],
  p: Progress,
): readonly Progress[] {
  const rest = tasks.filter((x) => x.id !== p.id);
  if (p.step !== undefined && ENDS.has(p.step)) return rest;
  const prev = tasks.find((x) => x.id === p.id);
  // A step without a number keeps the last one.
  const next =
    prev &&
    p.pct === undefined &&
    prev.pct !== undefined &&
    prev.step === p.step
      ? { ...p, pct: prev.pct }
      : p;
  return [...rest, next].slice(-MAX_TASKS);
}

export function trackProgress(
  store: Store,
  page: Pick<PageBridge, "subscribe">,
): () => void {
  return page.subscribe((e) => {
    if (e.type === "PROGRESS")
      store.set((s) => ({ tasks: withTick(s.tasks, e.payload) }));
    else if (e.type === "LOCK") store.set({ lock: e.payload });
    else if (e.type === "UPDATES") store.set({ updates: e.payload });
  });
}

/** The running tasks about this package. */
export const tasksFor = (
  state: Pick<UiState, "tasks">,
  packageId: string,
): readonly Progress[] => state.tasks.filter((x) => x.packageId === packageId);

/** Foundry's backup work, which locks its Setup while it runs. */
const LOCKING: ReadonlySet<string> = new Set([
  "createBackup",
  "restoreBackup",
  "deleteBackup",
  "createSnapshot",
  "restoreSnapshot",
  "deleteSnapshot",
  "updateDownload",
]);

/** Foundry's lock messages, as our own words. */
const LOCK_WORDS: ReadonlyMap<string, string> = new Map([
  ["SETUP.BACKUPS.BackingUp", "lock.backup"],
  ["SETUP.BACKUPS.Restoring", "lock.restore"],
  ["SETUP.BACKUPS.DeletingBackup", "lock.delete"],
  ["SETUP.BACKUPS.DeletingSnapshot", "lock.delete"],
  // Ours, while Foundry updates (page/update.ts UPDATING).
  ["SETUP.UpdateDownloading", "lock.update"],
]);

/** Why Restore, Delete and Launch wait, while Foundry is busy; else null. */
export function lockReason(
  t: (key: string) => string,
  state: Pick<UiState, "lock" | "tasks">,
): string | null {
  const backingUp = state.tasks.some((x) => LOCKING.has(x.action));
  if (!state.lock.locked && !backingUp) return null;
  // A Map: a message like "constructor" finds nothing (security review).
  const key = state.lock.message
    ? LOCK_WORDS.get(state.lock.message)
    : undefined;
  return t(key ?? "lock.busy");
}
