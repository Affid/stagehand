// Foundry's running tasks (backups, restores, snapshots, updates), its busy
// lock and the updates it would install, as the page world forwards them
// (page-progress.ts, page-updates.ts). Kept in the store, so they survive
// switching pages.
import { ENDS, type Lock, type Progress } from "../page-progress.ts";
import { withLaunchTick } from "./launching.ts";
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
    if (e.type === "PROGRESS" && e.payload.action === "launchWorld")
      store.set((s) => ({ launching: withLaunchTick(s.launching, e.payload) }));
    else if (e.type === "PROGRESS")
      store.set((s) => ({ tasks: withTick(s.tasks, e.payload) }));
    else if (e.type === "LOCK") store.set({ lock: e.payload });
    else if (e.type === "UPDATES") store.set({ updates: e.payload });
  });
}

/** Foundry's install of this package (an update or a new install), while it runs. */
export const installOf = (
  state: Pick<UiState, "tasks">,
  packageId: string,
): Progress | undefined =>
  state.tasks.find(
    (x) => x.action === "installPackage" && x.packageId === packageId,
  );

/** Every install Foundry is running. */
export const installsRunning = (
  state: Pick<UiState, "tasks">,
): readonly Progress[] =>
  state.tasks.filter((x) => x.action === "installPackage");

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

/** Why Restore, Delete and Launch wait, while Foundry is busy or installs; else null. */
export function lockReason(
  t: (key: string) => string,
  state: Pick<UiState, "lock" | "tasks"> & Partial<Pick<UiState, "install">>,
): string | null {
  const backingUp = state.tasks.some((x) => LOCKING.has(x.action));
  // A world launched mid-install would load half a module (updates plan).
  if (!state.lock.locked && !backingUp)
    return installsRunning(state).length || state.install?.running
      ? t("lock.install")
      : null;
  // A Map: a message like "constructor" finds nothing (security review).
  const key = state.lock.message
    ? LOCK_WORDS.get(state.lock.message)
    : undefined;
  return t(key ?? "lock.busy");
}

/**
 * Why this world can't launch now, or null: a locked world can't, nor can
 * any while Foundry backs up, restores or updates. One rule for every
 * Launch: the banner's, the phone's bar and Next launch sheet, and the
 * launch itself (review).
 */
export function launchOff(
  t: (key: string) => string,
  state: Pick<UiState, "lock" | "tasks"> & Partial<Pick<UiState, "install">>,
  world: { readonly locked?: boolean | undefined },
): string | null {
  return world.locked === true ? t("shell.launchLocked") : lockReason(t, state);
}
