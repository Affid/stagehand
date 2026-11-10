// Saves a world's details the way Foundry's World Configuration does
// (docs/SETUP-SPIKE.md, editing a world without WorldConfig): validate the
// changes on Foundry's own document, POST "editWorld" with only those
// fields (the server merges them into world.json), apply the answer, and
// re-render Foundry's Setup so our UI gets fresh data. "editWorld" is an
// internal request name: the UI only uses this behind the remote config's
// `editWorld` flag. Returns an error message, or undefined when saved.
import { FLAGS_KEY, type ScheduleData } from "@module-library/shared/world";
import type { WorldChanges } from "../page-save.ts";
import type { PageGlobals } from "./globals.ts";
import { redrawSetup } from "./redraw.ts";
import { logError } from "@module-library/shared/log";

interface EditableWorld {
  validate(options: { changes: object; clean: boolean }): void;
  updateSource(data: object): void;
}

export type SaveGlobals = Pick<PageGlobals, "game" | "ui">;

const message = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

type Stored = { readonly dates?: Readonly<Record<string, string>> } | undefined;
type Flags = Readonly<Record<string, { schedule?: Stored } | undefined>>;

/**
 * The schedule as a change to the stored one. Foundry merges objects, so
 * chosen dates that went (or all of them) get "-=" deletions (review: a
 * delete and a set in one request leaves nothing, live on 14.370).
 */
function scheduleChange(next: ScheduleData, stored: Stored): object {
  const before = stored?.dates ?? {};
  if (!next.dates) return stored?.dates ? { ...next, "-=dates": null } : next;
  const gone = Object.keys(before).filter((d) => !(d in (next.dates ?? {})));
  return {
    ...next,
    dates: {
      ...next.dates,
      ...Object.fromEntries(gone.map((d) => [`-=${d}`, null])),
    },
  };
}

/** Our fields as Foundry stores them: the schedule lives in our flags. */
function forFoundry(changes: WorldChanges, flags: Flags | undefined): object {
  const { schedule, ...rest } = changes;
  if (schedule === undefined) return rest;
  const ours =
    schedule === null
      ? { "-=schedule": null }
      : { schedule: scheduleChange(schedule, flags?.[FLAGS_KEY]?.schedule) };
  return { ...rest, flags: { [FLAGS_KEY]: ours } };
}

export async function saveWorld(
  page: SaveGlobals,
  worldId: string,
  wanted: WorldChanges,
): Promise<string | undefined> {
  const current = page.game?.worlds?.get?.(worldId) as
    { flags?: Flags } | undefined;
  const changes = forFoundry(wanted, current?.flags);
  const game = page.game;
  const world = game?.worlds?.get?.(worldId) as EditableWorld | undefined;
  if (!world || !game?.post) return `No world ${worldId}`;
  let data: object;
  try {
    world.validate({ changes: { id: worldId, ...changes }, clean: true });
    data = (await game.post({
      action: "editWorld",
      id: worldId,
      ...changes,
    })) as object;
  } catch (e: unknown) {
    return message(e);
  }
  copySaved(world, changes, data);
  await redrawSetup(page, "world");
  return undefined;
}

/**
 * Saved on the server: Setup's copy is a courtesy, as its redraw is, and its
 * failure must not read as an unsaved world. Merging the answer can't remove
 * a key ("-=" deletions), so ours goes first.
 */
function copySaved(world: EditableWorld, changes: object, data: object): void {
  try {
    world.updateSource(changes);
    world.updateSource(data);
  } catch (error: unknown) {
    logError("world copy", error);
  }
}
