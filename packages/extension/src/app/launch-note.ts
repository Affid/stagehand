// The note our Setup page leaves at a launch, for the app's running screen
// on /join (owner, 2026-11-09): which world was launched and how many queued
// changes go with it, so the screen can say "Join as Gamemaster · applies 2
// changes". In the server page's session storage: a page script could
// change the text shown, nothing else (the changes themselves stay with the
// background).
import { z } from "zod";

const KEY = "ml-launch";
/** A note older than this belongs to an earlier launch. */
const MAX_AGE_MS = 30 * 60_000;

const NoteSchema = z.object({
  world: z.string().min(1).max(200),
  changes: z.number().int().min(0).max(10_000),
  at: z.number(),
});

export function writeLaunchNote(
  store: Storage,
  world: string,
  changes: number,
  now: number = Date.now(),
): void {
  try {
    store.setItem(KEY, JSON.stringify({ world, changes, at: now }));
  } catch {
    // Storage blocked: the screen just won't count the changes.
  }
}

/** The changes launched with `world`, if a recent note says so. */
export function readLaunchNote(
  store: Storage,
  world: string,
  now: number = Date.now(),
): { readonly changes: number } | undefined {
  try {
    const parsed = NoteSchema.safeParse(JSON.parse(store.getItem(KEY) ?? ""));
    if (!parsed.success) return undefined;
    const note = parsed.data;
    if (note.world !== world || now - note.at > MAX_AGE_MS) return undefined;
    return { changes: note.changes };
  } catch {
    return undefined;
  }
}

/** The note is used up: a later visit to /join isn't this launch any more. */
export function clearLaunchNote(store: Storage): void {
  try {
    store.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was kept either.
  }
}
