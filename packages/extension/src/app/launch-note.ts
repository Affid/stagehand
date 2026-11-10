// The note our Setup page leaves at a launch, for the app's running screen
// on /join (owner, 2026-11-09): which world was launched and how many queued
// changes go with it. Applying them out of sight (phase 7) adds when it
// started, whether the companion took them up (the game page reloads in
// between) and the result; the launch's intent and the changes written with
// it say which of the companion's reports answers this launch. In the server
// page's session storage: a page script could change the text shown,
// nothing else (the changes live in the world's flags, and no password is
// ever kept here).
import { z } from "zod";

const KEY = "st-launch";
/** A note older than this belongs to an earlier launch. */
const MAX_AGE_MS = 30 * 60_000;

const ResultSchema = z.object({
  ok: z.boolean(),
  reason: z.string().max(500).optional(),
});

const NoteSchema = z.object({
  world: z.string().min(1).max(200),
  changes: z.number().int().min(0).max(10_000),
  at: z.number(),
  /** When the running page handed over to native to apply out of sight. */
  applyingAt: z.number().optional(),
  /** The companion took the changes up (applying). */
  acked: z.boolean().optional(),
  result: ResultSchema.optional(),
  /** The launch's intent written into the world's flags, by its id. */
  launchId: z.string().min(1).max(200).optional(),
  /** The queued changes written with it, by id. */
  ids: z.array(z.string().min(1).max(200)).max(50).optional(),
});

type Note = z.infer<typeof NoteSchema>;
export type ApplyResult = z.infer<typeof ResultSchema>;

/** What applying out of sight adds to the note. */
export type ApplyProgress = Partial<
  Pick<Note, "applyingAt" | "acked" | "result">
>;

/** The note's count and applying's progress, on top of `base`. */
function progressOf<B extends object>(
  note: Omit<Note, "at">,
  base: B,
): B & Omit<Note, "at" | "world"> {
  return {
    ...base,
    changes: note.changes,
    ...(note.applyingAt === undefined ? {} : { applyingAt: note.applyingAt }),
    ...(note.acked === undefined ? {} : { acked: note.acked }),
    ...(note.result === undefined ? {} : { result: note.result }),
    ...(note.launchId === undefined ? {} : { launchId: note.launchId }),
    ...(note.ids === undefined ? {} : { ids: note.ids }),
  };
}

/** The note as it is, if recent: on /game the world isn't known yet. */
export function currentLaunchNote(
  store: Storage,
  now: number = Date.now(),
): Omit<Note, "at"> | undefined {
  try {
    const parsed = NoteSchema.safeParse(JSON.parse(store.getItem(KEY) ?? ""));
    if (!parsed.success || now - parsed.data.at > MAX_AGE_MS) return undefined;
    return progressOf(parsed.data, { world: parsed.data.world });
  } catch {
    return undefined;
  }
}

/** Adds applying's progress to the note there is (none: nothing to add to). */
export function updateLaunchNote(store: Storage, change: ApplyProgress): void {
  try {
    const parsed = NoteSchema.safeParse(JSON.parse(store.getItem(KEY) ?? ""));
    if (!parsed.success) return;
    store.setItem(KEY, JSON.stringify({ ...parsed.data, ...change }));
  } catch {
    // Storage blocked: the running page then can't say how applying went.
  }
}

/** The launch's intent and the changes written with it. */
export interface LaunchWritten {
  readonly launchId: string;
  readonly ids: readonly string[];
}

export function writeLaunchNote(
  store: Storage,
  world: string,
  changes: number,
  now: number = Date.now(),
  written?: LaunchWritten,
): void {
  const launch = written
    ? { launchId: written.launchId, ids: written.ids.slice(0, 50) }
    : {};
  try {
    store.setItem(KEY, JSON.stringify({ world, changes, at: now, ...launch }));
  } catch {
    // Storage blocked: the screen just won't count the changes.
  }
}

/** The changes launched with `world`, if a recent note says so. */
export function readLaunchNote(
  store: Storage,
  world: string,
  now: number = Date.now(),
): Omit<Note, "at" | "world"> | undefined {
  const note = currentLaunchNote(store, now);
  if (note?.world !== world) return undefined;
  return progressOf(note, {});
}

/** The note is used up: a later visit to /join isn't this launch any more. */
export function clearLaunchNote(store: Storage): void {
  try {
    store.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was kept either.
  }
}
