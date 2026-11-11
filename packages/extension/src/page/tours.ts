// Foundry's tours on our Setup page (owner, 2026-11-11). Its backups
// overview starts by itself the first time Setup opens (client/game.mjs,
// "Initial prompts"); its steps point at Foundry's own Setup, which our
// page covers, so over ours it only gets in the way. It is kept from
// starting here; Foundry's progress setting is left alone, so the tour
// still comes on Foundry's own Setup.
import { logError } from "@stagehand/shared/log";
import type { PageGlobals } from "./globals.ts";

/** The tours Foundry starts without being asked on Setup. */
const SELF_STARTING = ["core.backupsOverview"];

interface Startable {
  start: () => Promise<void>;
}

const isStartable = (tour: unknown): tour is Startable =>
  typeof tour === "object" &&
  tour !== null &&
  typeof (tour as { start?: unknown }).start === "function";

/**
 * Makes Foundry's self-starting Setup tours do nothing when started; false
 * while Foundry hasn't registered them yet (asked again then).
 */
export function quietSetupTours(page: PageGlobals): boolean {
  const tours = page.game?.tours;
  let quiet = false;
  for (const id of SELF_STARTING) {
    const tour = tours?.get?.(id);
    if (!isStartable(tour)) continue;
    tour.start = () => Promise.resolve();
    quiet = true;
  }
  return quiet;
}

interface Drawn {
  /** Foundry's click-blocking overlay: set once the tour's step is drawn. */
  readonly overlayElement?: unknown;
  reset: () => Promise<unknown>;
}

const isDrawn = (tour: unknown): tour is Drawn =>
  typeof tour === "object" &&
  tour !== null &&
  typeof (tour as { reset?: unknown }).reset === "function";

const WATCH_MS = 100;
/** Foundry draws a started tour within moments; ten seconds covers a slow server. */
const WATCH_TRIES = 100;

/** Takes the tour away once its step is drawn; looks again until then. */
function closeOnceDrawn(tour: Drawn, tries: number): void {
  if (tour.overlayElement) {
    // Reset on Foundry's object: its step, fade and overlay go, and the tour
    // is unstarted again, as it was before Foundry started it here.
    tour.reset().catch((error: unknown) => {
      logError("tour reset", error);
    });
    return;
  }
  if (tries < WATCH_TRIES)
    setTimeout(() => {
      closeOnceDrawn(tour, tries + 1);
    }, WATCH_MS);
}

/**
 * Closes a self-starting tour Foundry started before ours could keep it
 * from starting (ours comes up after Foundry's Setup). Foundry starts it in
 * steps and draws it last, so exiting at once would leave its step on
 * screen with nothing to close it: each tour is watched until drawn.
 */
export function closeStartedTours(page: PageGlobals): void {
  for (const id of SELF_STARTING) {
    const tour = page.game?.tours?.get?.(id);
    if (isDrawn(tour)) closeOnceDrawn(tour, 0);
  }
}
