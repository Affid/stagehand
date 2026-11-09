// The game page while the app applies a launch's changes out of sight
// (Android plan, phase 7): native covers it; this watches the companion
// through the relay (apply-watch.ts), keeps what it saw in the launch note
// (the page reloads once on the way), records the result for our running
// page and tells native, once. It gives up shortly before native does.
import { logError } from "@module-library/shared/log";
import type { Envelope } from "@module-library/shared/protocol";
import { watchStep, type WatchState } from "./apply-watch.ts";
import {
  type ApplyResult,
  currentLaunchNote,
  updateLaunchNote,
} from "./launch-note.ts";
import { APPLY_MAX_MS } from "./native-api.ts";

/** Given up this long before native's own limit, so the reason is ours. */
const MARGIN_MS = 15_000;
const TIMED_OUT =
  "The changes didn't finish applying in time. They stay queued; launch the world again to apply them.";

export interface ApplyGameDeps {
  readonly store: Storage;
  /** Tells native (apply.done): the cover goes, /join again. */
  readonly done: (ok: boolean) => Promise<void>;
  readonly now?: () => number;
}

/** The watch for this game page's relay while applying, or undefined when it isn't. */
export function applyWatcher(
  deps: ApplyGameDeps,
): ((msg: Envelope, reply: Envelope) => void) | undefined {
  const now = deps.now ?? Date.now;
  const note = currentLaunchNote(deps.store, now());
  if (note?.applyingAt === undefined || note.result) return undefined;
  const left = APPLY_MAX_MS - MARGIN_MS - (now() - note.applyingAt);
  if (left <= 0) return undefined;
  let state: WatchState = { acked: note.acked === true };
  let finished = false;
  const finish = (result: ApplyResult): void => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    updateLaunchNote(deps.store, { result });
    deps.done(result.ok).catch((error: unknown) => {
      logError("apply done", error);
    });
  };
  const timer = setTimeout(() => {
    finish({ ok: false, reason: TIMED_OUT });
  }, left);
  return (msg, reply) => {
    const step = watchStep(state, msg, reply);
    if (step.state.acked && !state.acked)
      updateLaunchNote(deps.store, { acked: true });
    state = step.state;
    if (step.event?.kind === "done") finish({ ok: true });
    else if (step.event) finish({ ok: false, reason: step.event.reason });
  };
}
