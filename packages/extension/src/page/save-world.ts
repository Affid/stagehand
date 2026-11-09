// Saves a world's details the way Foundry's World Configuration does
// (docs/SETUP-SPIKE.md, editing a world without WorldConfig): validate the
// changes on Foundry's own document, POST "editWorld" with only those
// fields (the server merges them into world.json), apply the answer, and
// re-render Foundry's Setup so our UI gets fresh data. "editWorld" is an
// internal request name: the UI only uses this behind the remote config's
// `editWorld` flag. Returns an error message, or undefined when saved.
import {
  FLAGS_KEY,
  LEGACY_FLAGS_KEY,
  type ScheduleData,
} from "@module-library/shared/world";
import type { WorldChanges } from "../page-save.ts";
import type { PageGlobals } from "./globals.ts";

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

/**
 * Our fields as Foundry stores them: the schedule lives in our flags. Flags
 * left under the name before the rename go on the same save; until then
 * they are read in their place (collect.ts).
 */
function forFoundry(changes: WorldChanges, flags: Flags | undefined): object {
  const { schedule, ...rest } = changes;
  if (schedule === undefined) return rest;
  const ours =
    schedule === null
      ? { "-=schedule": null }
      : { schedule: scheduleChange(schedule, flags?.[FLAGS_KEY]?.schedule) };
  const legacy = flags?.[LEGACY_FLAGS_KEY]
    ? { [`-=${LEGACY_FLAGS_KEY}`]: null }
    : {};
  return { ...rest, flags: { [FLAGS_KEY]: ours, ...legacy } };
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
  try {
    world.validate({ changes: { id: worldId, ...changes }, clean: true });
    const data = (await game.post({
      action: "editWorld",
      id: worldId,
      ...changes,
    })) as object;
    // Merging the answer can't remove a key ("-=" deletions): apply ours first.
    world.updateSource(changes);
    world.updateSource(data);
    const setup = page.ui?.setupPackages as
      { render?: () => unknown } | undefined;
    await setup?.render?.();
    return undefined;
  } catch (e: unknown) {
    return message(e);
  }
}
