// Applying a launch's changes out of sight (Android plan, phase 7): the game
// page's relay sees the companion's messages and the background's replies.
// The companion acknowledges the commands ("applying"), writes the world's
// module configuration and reloads it once; after the reload it pulls again
// and gets none. A failed acknowledgement carries Foundry's reason. The page
// reloads in between, so the one thing to remember (acknowledged) is kept
// by the caller, in the launch note.
import type { Envelope } from "@module-library/shared/protocol";

export interface WatchState {
  /** The companion acknowledged the commands as applying. */
  readonly acked: boolean;
}

export type WatchEvent =
  | { readonly kind: "done" }
  | { readonly kind: "failed"; readonly reason: string };

export interface WatchStep {
  readonly state: WatchState;
  readonly event?: WatchEvent;
}

type Loose = Readonly<Record<string, unknown>>;
const payloadOf = (e: Envelope | undefined): Loose =>
  e && typeof e.payload === "object" && e.payload !== null
    ? (e.payload as Loose)
    : {};

const MAX_REASON = 500;
const NO_REASON = "The companion didn't say why.";
const NOTHING =
  "Nothing was applied: the changes were no longer queued when the world opened.";

/** One relayed message and its reply: the state after it, and done or failed. */
export function watchStep(
  state: WatchState,
  msg: Envelope,
  reply: Envelope | undefined,
): WatchStep {
  const sent = payloadOf(msg);
  if (msg.type === "COMMAND_ACK" && sent.status === "failed") {
    const reason = typeof sent.error === "string" ? sent.error : NO_REASON;
    return {
      state,
      event: { kind: "failed", reason: reason.slice(0, MAX_REASON) },
    };
  }
  if (msg.type === "COMMAND_ACK" && sent.status === "applying")
    return { state: { acked: true } };
  if (msg.type === "COMMANDS_PULL") {
    const world = payloadOf(reply).world;
    // None left after the acknowledgement (the world reloaded): applied. None
    // before it: they were no longer queued, so nothing was (review).
    if (Array.isArray(world) && world.length === 0)
      return state.acked
        ? { state, event: { kind: "done" } }
        : { state, event: { kind: "failed", reason: NOTHING } };
  }
  // Acknowledged, then a fresh snapshot with no reload: nothing to change.
  if (msg.type === "SNAPSHOT_PUSH" && state.acked)
    return { state, event: { kind: "done" } };
  return { state };
}
