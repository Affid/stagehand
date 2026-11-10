// A world being launched (Android plan, phase 7): our page shows it from the
// tap, because Foundry draws its own progress in its hidden Setup. Foundry's
// launch sends ticks for the world (action launchWorld, id = the world's id)
// as it migrates the core data, reads the world and checks it; "complete"
// ends it, then Foundry leaves Setup.
import type { WorldInfo } from "@stagehand/shared/world";
import type { Progress } from "../page-progress.ts";
import type { Store } from "./store.ts";

export interface Launching {
  readonly worldId: string;
  readonly title: string;
  /** Foundry backs the world up first ("Back up first" in the review). */
  readonly backup: boolean;
  /** Foundry's last step and its percent, from its ticks. */
  readonly step?: string;
  readonly pct?: number;
  /** Foundry's reason, when the launch failed. */
  readonly error?: string;
}

export type LaunchStage = "backup" | "ask" | "load" | "open" | "failed";

export interface LaunchView {
  readonly stage: LaunchStage;
  /** The whole launch, 0 to 100, for one bar. */
  readonly pct: number;
  /** Foundry's step while loading, for our words. */
  readonly detail?: string;
}

/** Where each of Foundry's loading steps sits on our one bar. */
const LOAD_SPANS: Readonly<Record<string, readonly [number, number]>> = {
  migrateCore: [10, 30],
  connectWorld: [30, 70],
  migrateWorld: [70, 90],
  connectPackage: [90, 94],
  migratePackage: [94, 98],
};
const ASK_PCT = 5;

export function startLaunch(
  store: Store,
  world: Pick<WorldInfo, "id" | "title">,
  backup: boolean,
): void {
  store.set({ launching: { worldId: world.id, title: world.title, backup } });
}

export function stopLaunch(store: Store): void {
  store.set({ launching: null });
}

/** The launch after one of Foundry's ticks; ticks for other worlds change nothing. */
export function withLaunchTick(
  launching: Launching | null,
  tick: Progress,
): Launching | null {
  if (!launching || tick.action !== "launchWorld") return launching;
  if (tick.id !== launching.worldId) return launching;
  // What a tick doesn't say stays, except a percent from an earlier step.
  const newStep = tick.step !== undefined && tick.step !== launching.step;
  const kept: Launching = newStep
    ? {
        worldId: launching.worldId,
        title: launching.title,
        backup: launching.backup,
      }
    : launching;
  return {
    ...kept,
    ...(tick.step === undefined ? {} : { step: tick.step }),
    ...(tick.pct === undefined ? {} : { pct: tick.pct }),
    ...(tick.error === undefined ? {} : { error: tick.error }),
  };
}

export function launchView(l: Launching): LaunchView {
  if (l.step === "error") return { stage: "failed", pct: 100 };
  if (l.step === "complete") return { stage: "open", pct: 100 };
  const step = l.step;
  const span = step === undefined ? undefined : LOAD_SPANS[step];
  if (step !== undefined && span) {
    const [from, to] = span;
    const pct = Math.round(from + ((to - from) * (l.pct ?? 0)) / 100);
    return { stage: "load", pct, detail: step };
  }
  // No tick yet: Foundry is backing up first, or about to answer.
  return { stage: l.backup ? "backup" : "ask", pct: ASK_PCT };
}
