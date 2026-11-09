// Applying a launch's changes out of sight (Android plan, phase 7), our
// running page's part: Foundry's Setup doesn't know a world's users, so the
// choice of user comes here, after the launch. Only for a launch native has
// on record (our Setup recorded it), it joins as the world's full Gamemaster
// (the only one the companion applies for) by Foundry's own join request,
// with no password first (Foundry's default); only when Foundry wants one
// does the page ask, on a tap, in native's sheet. Joined, it records the
// hand-over and tells native (apply.start), which covers the WebView while
// the game loads behind it.
import {
  clearLaunchNote,
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
  /** Whether native has this world's launch on record (apply.allowed). */
  readonly allowed: (world: string) => Promise<boolean>;
  /** Native covers the WebView and lets /game load (apply.start). */
  readonly start: (
    world: string,
    title: string,
    changes: number,
  ) => Promise<void>;
  /** Goes where Foundry sent the joined user. */
  readonly go: (path: string) => void;
}

const QUEUED = "They stay queued for the next launch.";
const UNFINISHED =
  "The changes didn't finish applying. They stay queued; launch the world again to apply them.";
const NO_GM = `There's no Gamemaster user in this world to apply them as. ${QUEUED}`;
const NO_JOIN = `Foundry didn't let the app join to apply them. ${QUEUED}`;
const NO_COVER = `The app couldn't apply them out of sight. ${QUEUED}`;
export const NOT_NOW = `Not applied now. ${QUEUED}`;

/**
 * What the page shows as it opens, from the launch note. A result is said
 * once: the note goes with it, so a later visit isn't this launch (review).
 */
export function applyAtStart(deps: ApplyFlowDeps): ApplyView | undefined {
  const note = readLaunchNote(deps.store, deps.world.id);
  if (!note || note.changes === 0) return undefined;
  const n = note.changes;
  if (!note.result && note.applyingAt === undefined)
    return { kind: "start", n };
  clearLaunchNote(deps.store);
  if (note.result?.ok) return { kind: "applied", n };
  return { kind: "failed", n, reason: note.result?.reason ?? UNFINISHED };
}

/**
 * Starts applying, only for a launch native has on record: a note in the
 * page's storage alone, which any script there could write, joins nothing
 * (security review).
 */
export async function beginApply(
  deps: ApplyFlowDeps,
  n: number,
): Promise<ApplyView | undefined> {
  const allowed = await deps.allowed(deps.world.id).catch(() => false);
  if (allowed) return joinAndHandOver(deps, n, "");
  clearLaunchNote(deps.store);
  return undefined;
}

/** Kept in the note: the next visit to /join says it (once). */
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
 * hands over to native. Only Foundry's wrong-password answer asks for the
 * password; another refusal says Foundry's reason.
 */
export async function joinAndHandOver(
  deps: ApplyFlowDeps,
  n: number,
  password: string,
): Promise<ApplyView> {
  const gm = joinUsers(deps.game()).find((u) => u.full);
  if (!gm) return failApply(deps, n, NO_GM);
  const result = await deps.join(gm.id, password);
  if (result.kind === "password")
    return { kind: "password", n, user: gm.name, wrong: password !== "" };
  if (result.kind === "refused")
    return failApply(deps, n, `${result.message} ${QUEUED}`);
  if (result.kind === "failed") return failApply(deps, n, NO_JOIN);
  updateLaunchNote(deps.store, { applyingAt: Date.now() });
  try {
    await deps.start(deps.world.id, deps.world.title, n);
  } catch {
    return failApply(deps, n, NO_COVER);
  }
  deps.go(result.redirect);
  return { kind: "applying", n };
}
