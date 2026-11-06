// Saves a world's details the way Foundry's World Configuration does
// (docs/SETUP-SPIKE.md, editing a world without WorldConfig): validate the
// changes on Foundry's own document, POST "editWorld" with only those
// fields (the server merges them into world.json), apply the answer, and
// re-render Foundry's Setup so our UI gets fresh data. "editWorld" is an
// internal request name: the UI only uses this behind the remote config's
// `editWorld` flag. Returns an error message, or undefined when saved.
import type { WorldChanges } from "../page-save.ts";
import type { PageGlobals } from "./globals.ts";

interface EditableWorld {
  validate(options: { changes: object; clean: boolean }): void;
  updateSource(data: object): void;
}

export type SaveGlobals = Pick<PageGlobals, "game" | "ui">;

const message = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export async function saveWorld(
  page: SaveGlobals,
  worldId: string,
  changes: WorldChanges,
): Promise<string | undefined> {
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
    world.updateSource(data);
    const setup = page.ui?.setupPackages as
      { render?: () => unknown } | undefined;
    await setup?.render?.();
    return undefined;
  } catch (e: unknown) {
    return message(e);
  }
}
