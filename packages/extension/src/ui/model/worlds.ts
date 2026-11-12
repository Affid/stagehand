// View model for the Game Worlds tab (W-1 to W-3, P-5, P-6): each world's
// status, its queue and what its next launch will change.
import type { Plan } from "@stagehand/shared/resolver";
import type { Command, Snapshot, WorldInfo } from "@stagehand/shared/world";
import type { SetupState } from "../../messages.ts";
import { pendingFor, previewApply } from "./preview.ts";

// No "stale": Foundry stamps lastPlayed when a world closes as well as at
// launch, so a report older than lastPlayed only means a long session.
export type WorldStatus = "ok" | "no-companion" | "outdated";
/** Why a world is listed under "needs attention". */
export type Attention = Exclude<WorldStatus, "ok"> | "failed";

export interface WorldRow {
  readonly world: WorldInfo;
  readonly snapshot: Snapshot | undefined;
  readonly status: WorldStatus;
  readonly pending: readonly Command[];
  /** Finished commands worth showing: failed, declined or applied. */
  readonly recent: readonly Command[];
  /** The combined result of the queue at the next launch (P-6). */
  readonly plan: Plan | undefined;
  readonly attention: Attention | undefined;
}

const RECENT = new Set(["applied", "failed", "declined"]);
const RECENT_LIMIT = 5;

export function worldStatus(
  world: WorldInfo,
  snapshot: Snapshot | undefined,
): WorldStatus {
  // Left by a newer Stagehand: this one leaves the world's queue alone.
  if (world.stagehand?.newer === true) return "outdated";
  return snapshot ? "ok" : "no-companion";
}

const ATTENTION_ORDER: readonly Attention[] = [
  "outdated",
  "failed",
  "no-companion",
];

function attentionOf(
  status: WorldStatus,
  recent: readonly Command[],
): Attention | undefined {
  const failed = recent.at(-1)?.status === "failed";
  const reasons: Attention[] = [
    ...(status === "ok" ? [] : [status]),
    ...(failed ? (["failed"] as const) : []),
  ];
  return ATTENTION_ORDER.find((a) => reasons.includes(a));
}

export function worldRow(state: SetupState, world: WorldInfo): WorldRow {
  const snapshot = state.snapshots[world.id];
  const recent = state.commands
    .filter((c) => c.worldId === world.id && RECENT.has(c.status))
    .slice(-RECENT_LIMIT);
  const status = worldStatus(world, snapshot);
  return {
    world,
    snapshot,
    status,
    pending: pendingFor(state, world.id),
    recent,
    plan: previewApply(state, { worldId: world.id, removeDependents: false })
      .plan,
    attention: attentionOf(status, recent),
  };
}

export const worldRows = (state: SetupState): WorldRow[] =>
  (state.setup?.worlds ?? []).map((w) => worldRow(state, w));

/** Up to these, an age reads in days, weeks or months; beyond, in years. */
const DAYS_UNTIL = 14;
const WEEKS_UNTIL = 60;
const MONTHS_UNTIL = 730;

/** An age in whole minutes, hours, days, weeks, months or years. */
export function age(takenAt: string, now: number): { n: number; unit: string } {
  const minutes = Math.max(0, Math.round((now - Date.parse(takenAt)) / 60000));
  if (minutes < 1) return { n: 0, unit: "now" };
  if (minutes < 60) return { n: minutes, unit: "minutes" };
  const hours = Math.round(minutes / 60);
  if (hours < 48) return { n: hours, unit: "hours" };
  const days = Math.round(hours / 24);
  if (days < DAYS_UNTIL) return { n: days, unit: "days" };
  if (days < WEEKS_UNTIL) return { n: Math.round(days / 7), unit: "weeks" };
  if (days < MONTHS_UNTIL)
    return { n: Math.round(days / 30.44), unit: "months" };
  return { n: Math.round(days / 365.25), unit: "years" };
}
