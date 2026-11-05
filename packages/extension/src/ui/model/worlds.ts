// View model for the worlds panel (W-1, W-2, P-5).
import type {
  Command,
  Snapshot,
  WorldInfo,
} from "@module-library/shared/world";
import type { SetupState } from "../../messages.ts";

export type WorldStatus = "ok" | "no-companion" | "stale" | "outdated";

export interface WorldRow {
  readonly world: WorldInfo;
  readonly snapshot: Snapshot | undefined;
  readonly status: WorldStatus;
  readonly pending: readonly Command[];
  /** Finished commands worth showing: failed, declined or applied. */
  readonly recent: readonly Command[];
}

const RECENT = new Set(["applied", "failed", "declined"]);
const RECENT_LIMIT = 3;
/** Foundry updates lastPlayed on launch, just before the snapshot. */
const STALE_MARGIN_MS = 10 * 60 * 1000;

function status(
  world: WorldInfo,
  snapshot: Snapshot | undefined,
  state: SetupState,
): WorldStatus {
  if (state.hellos[world.id]?.protocol === null) return "outdated";
  if (!snapshot) return "no-companion";
  const played = Date.parse(world.lastPlayed ?? "");
  const taken = Date.parse(snapshot.takenAt);
  if (Number.isFinite(played) && taken + STALE_MARGIN_MS < played)
    return "stale";
  return "ok";
}

export function worldRows(state: SetupState): WorldRow[] {
  return (state.setup?.worlds ?? []).map((world) => {
    const snapshot = state.snapshots[world.id];
    const mine = state.commands.filter((c) => c.worldId === world.id);
    return {
      world,
      snapshot,
      status: status(world, snapshot, state),
      pending: mine.filter((c) => c.status === "pending"),
      recent: mine.filter((c) => RECENT.has(c.status)).slice(-RECENT_LIMIT),
    };
  });
}

/** Snapshot age in whole minutes, hours or days, for display. */
export function age(takenAt: string, now: number): { n: number; unit: string } {
  const minutes = Math.max(0, Math.round((now - Date.parse(takenAt)) / 60000));
  if (minutes < 60) return { n: minutes, unit: "minutes" };
  const hours = Math.round(minutes / 60);
  if (hours < 48) return { n: hours, unit: "hours" };
  return { n: Math.round(hours / 24), unit: "days" };
}
