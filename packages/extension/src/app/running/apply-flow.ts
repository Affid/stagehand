// Applying a launch's changes out of sight (Android plan, phase 7), our
// running page's part: Foundry's Setup doesn't know a world's users, so the
// choice of user comes here, after the launch. It joins as the world's full
// Gamemaster (the only one the companion applies for) by Foundry's own join
// request, with no password first (Foundry's default); only when Foundry
// wants one does the page ask, on a tap, in native's sheet. Joined, it
// records the hand-over and tells native (apply.start), which covers the
// WebView while the game loads behind it.
import {
  currentLaunchNote,
  readLaunchNote,
  updateLaunchNote,
} from "../launch-note.ts";
import { type JoinResult, joinUsers } from "./server.ts";

export type ApplyView =
  | { readonly kind: "start"; readonly n: number }
  | { readonly kind: "applying"; readonly n: number }
  | {
      readonly kind: "password";
      readonly n: number;
      readonly user: string;
      readonly wrong: boolean;
    }
  | { readonly kind: "applied"; readonly n: number }
  | { readonly kind: "failed"; readonly n: number; readonly reason: string };

export interface ApplyFlowDeps {
  readonly store: Storage;
  readonly world: { readonly id: string; readonly title: string };
  /** Foundry's `game` on /join (its users). */
  readonly game: () => unknown;
  readonly join: (userId: string, password: string) => Promise<JoinResult>;
  /** Native covers the WebView and lets /game load (apply.start). */
  readonly start: (world: string, changes: number) => Promise<void>;
  /** Goes where Foundry sent the joined user. */
  readonly go: (path: string) => void;
}

const UNFINISHED =
  "The changes didn't finish applying. They stay queued; launch the world again to apply them.";
const NO_GM =
  "There's no Gamemaster user in this world to apply them as. They stay queued for the next launch.";
const NO_JOIN =
  "Foundry didn't let the app join to apply them. They stay queued for the next launch.";
const NO_COVER =
  "The app couldn't apply them out of sight. They stay queued for the next launch.";
export const NOT_NOW = "Not applied now. They stay queued for the next launch.";

/** What the page shows as it opens, from the launch note. */
export function applyAtStart(deps: ApplyFlowDeps): ApplyView | undefined {
  const note = readLaunchNote(deps.store, deps.world.id);
  if (!note || note.changes === 0) return undefined;
  const n = note.changes;
  if (note.result)
    return note.result.ok
      ? { kind: "applied", n }
      : { kind: "failed", n, reason: note.result.reason ?? UNFINISHED };
  if (note.applyingAt !== undefined)
    return { kind: "failed", n, reason: UNFINISHED };
  return { kind: "start", n };
}

/** Kept in the note: a later visit to /join says the same. */
export function failApply(
  deps: ApplyFlowDeps,
  n: number,
  reason: string,
): ApplyView {
  if (currentLaunchNote(deps.store))
    updateLaunchNote(deps.store, { result: { ok: false, reason } });
  return { kind: "failed", n, reason };
}

/**
 * Joins as the full Gamemaster with `password` ("" the first time), then
 * hands over to native. Foundry's refusal asks for the password.
 */
export async function joinAndHandOver(
  deps: ApplyFlowDeps,
  n: number,
  password: string,
): Promise<ApplyView> {
  const gm = joinUsers(deps.game()).find((u) => u.full);
  if (!gm) return failApply(deps, n, NO_GM);
  const result = await deps.join(gm.id, password);
  if (result.kind === "refused")
    return { kind: "password", n, user: gm.name, wrong: password !== "" };
  if (result.kind === "failed") return failApply(deps, n, NO_JOIN);
  updateLaunchNote(deps.store, { applyingAt: Date.now() });
  try {
    await deps.start(deps.world.title, n);
  } catch {
    return failApply(deps, n, NO_COVER);
  }
  deps.go(result.redirect);
  return { kind: "applying", n };
}
