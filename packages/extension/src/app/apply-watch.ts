// Applying a launch's changes out of sight (Android plan, phase 7): the game
// page reads the companion's report in the world's flags
// (docs/COMPANION-WORLD-PROTOCOL.md). The report that answers this launch
// carries its intent's id; the companion records our changes as applying,
// writes the world's module configuration and reloads it once; after the
// reload they read applied (or failed). The page reloads in between, so the
// one thing to remember (taken up) is kept by the caller, in the launch note.
import { readStagehand } from "@stagehand/shared/world-flags";

export interface WatchNote {
  /** The launch's intent written into the world's flags. */
  readonly launchId?: string | undefined;
  /** The changes written with it. */
  readonly ids?: readonly string[] | undefined;
  /** The companion took them up (applying) on an earlier page. */
  readonly acked: boolean;
}

export type WatchEvent =
  | { readonly kind: "done" }
  | { readonly kind: "failed"; readonly reason: string };

export interface WatchStep {
  readonly acked: boolean;
  readonly event?: WatchEvent;
}

const MAX_REASON = 500;
const NO_REASON = "The companion didn't say why.";
const DECLINED = "The changes were discarded in the companion's dialog.";
const NOT_APPLIED =
  "The changes weren't applied when the world opened: they need a Gamemaster's confirmation in the world, or were no longer queued.";

/** Our flags as the page has them: what this launch's changes came to. */
export function watchStep(note: WatchNote, flags: unknown): WatchStep {
  const report = readStagehand(flags).report;
  const waiting = { acked: note.acked };
  if (note.launchId === undefined || report?.launchId !== note.launchId)
    return waiting;
  const ids = new Set(note.ids ?? []);
  const mine = report.results.filter((r) => ids.has(r.id));
  const bad = mine.find(
    (r) => r.status === "failed" || r.status === "declined",
  );
  if (bad) {
    const why = bad.status === "declined" ? DECLINED : (bad.error ?? NO_REASON);
    return {
      ...waiting,
      event: { kind: "failed", reason: why.slice(0, MAX_REASON) },
    };
  }
  if (mine.some((r) => r.status === "applying")) return { acked: true };
  // Every change of ours applied, or this launch's report says no more.
  if (mine.length < ids.size || ids.size === 0)
    return { ...waiting, event: { kind: "failed", reason: NOT_APPLIED } };
  return { ...waiting, event: { kind: "done" } };
}
