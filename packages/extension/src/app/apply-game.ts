// The game page while the app applies a launch's changes out of sight
// (Android plan, phase 7): native covers it; this reads the companion's
// report in the world's flags (apply-watch.ts) as the page has them, keeps
// what it saw in the launch note (the page reloads once on the way),
// records the result for our running page and tells native, once. It gives
// up shortly before native does.
import { logError } from "@module-library/shared/log";
import { watchStep } from "./apply-watch.ts";
import {
  type ApplyResult,
  currentLaunchNote,
  updateLaunchNote,
} from "./launch-note.ts";
import { APPLY_MAX_MS } from "./native-api.ts";

/** Given up this long before native's own limit, so the reason is ours. */
const MARGIN_MS = 15_000;
/** How often the page's copy of our flags is read. */
export const WATCH_EVERY_MS = 500;
const TIMED_OUT =
  "The changes didn't finish applying in time. They stay queued; launch the world again to apply them.";

export interface ApplyGameDeps {
  readonly store: Storage;
  /** Our flags as the game page has them (the companion keeps them current). */
  readonly flags: () => unknown;
  /** Tells native (apply.done): the cover goes, /join again. */
  readonly done: (ok: boolean) => Promise<void>;
  readonly now?: () => number;
}

/**
 * Watches this game page while applying; returns a stop (tests), or
 * undefined when this page isn't applying.
 */
export function startApplyWatch(deps: ApplyGameDeps): (() => void) | undefined {
  const now = deps.now ?? Date.now;
  const note = currentLaunchNote(deps.store, now());
  if (note?.applyingAt === undefined || note.result) return undefined;
  const left = APPLY_MAX_MS - MARGIN_MS - (now() - note.applyingAt);
  if (left <= 0) return undefined;
  let acked = note.acked === true;
  const stop = (): void => {
    clearTimeout(timer);
    clearInterval(poll);
  };
  const finish = (result: ApplyResult): void => {
    stop();
    updateLaunchNote(deps.store, { result });
    deps.done(result.ok).catch((error: unknown) => {
      logError("apply done", error);
    });
  };
  const timer = setTimeout(() => {
    finish({ ok: false, reason: TIMED_OUT });
  }, left);
  const poll = setInterval(() => {
    const step = watchStep({ ...note, acked }, deps.flags());
    if (step.acked && !acked) updateLaunchNote(deps.store, { acked: true });
    acked = step.acked;
    if (step.event?.kind === "done") finish({ ok: true });
    else if (step.event) finish({ ok: false, reason: step.event.reason });
  }, WATCH_EVERY_MS);
  return stop;
}
