// Foundry actions for the new Setup page. Foundry's private flows (its menu buttons,
// a world's launch control) are reached by clicking its own hidden controls, so its
// prompts, locks and migration checks still run; the rest uses public API.
// Returns an error message, or undefined when the action was started.
import type { FoundryAction } from "../page-protocol.ts";
import type { PageGlobals } from "./globals.ts";
import { saveWorld } from "./save-world.ts";

const MENU_ACTION: Record<string, string> = {
  warnings: "viewWarnings",
  logout: "adminLogout",
  shutdown: "shutDown",
};
const FAVORITES = "setupPackageFavorites";

interface WorldLike {
  readonly id: string;
  favorite?: boolean;
}
export type ActionGlobals = Pick<PageGlobals, "game" | "ui" | "foundry">;

function click(
  doc: Document,
  selector: string,
  what: string,
): string | undefined {
  const el = doc.querySelector<HTMLElement>(selector);
  if (!el) return `Foundry's ${what} control is missing`;
  el.click();
  return undefined;
}

const worldOf = (page: ActionGlobals, id: string): WorldLike | undefined => {
  const w = page.game?.worlds?.get?.(id) as WorldLike | undefined;
  return w && typeof w === "object" ? w : undefined;
};

function launch(doc: Document, worldId: string): string | undefined {
  const cards = [
    ...doc.querySelectorAll<HTMLElement>("li.package.world[data-package-id]"),
  ];
  const card = cards.find((c) => c.dataset.packageId === worldId);
  const control = card?.querySelector<HTMLElement>(
    '[data-action="worldLaunch"]',
  );
  if (!control) return `Foundry's launch control for ${worldId} is missing`;
  control.click();
  return undefined;
}

/** "Back up first": Foundry's own backup (its lock and messages), then the launch. */
async function backupThenLaunch(
  doc: Document,
  page: ActionGlobals,
  id: string,
  note: string | undefined,
): Promise<string | undefined> {
  const world = worldOf(page, id);
  const game = page.game;
  if (!world || !game?.createBackup) return `No world ${id}`;
  const done = await game.createBackup(world, note ? { note } : {});
  if (!done) return `The backup didn't finish, so ${id} was not launched`;
  return launch(doc, id);
}

/** As Foundry's card menu does (SetupPackages#toggleFavorite): its own setting, then a re-render. */
async function toggleFavorite(
  page: ActionGlobals,
  id: string,
): Promise<string | undefined> {
  const world = worldOf(page, id),
    settings = page.game?.settings;
  if (!world || !settings) return `No world ${id}`;
  const current = (settings.get("core", FAVORITES) ?? {}) as Record<
    string,
    readonly string[]
  >;
  const worlds = current.worlds ?? [];
  const next = {
    ...current,
    worlds: world.favorite ? worlds.filter((w) => w !== id) : [...worlds, id],
  };
  await settings.set("core", FAVORITES, next);
  world.favorite = !world.favorite;
  const setup = page.ui?.setupPackages as
    { render?: () => unknown } | undefined;
  setup?.render?.();
  return undefined;
}

/**
 * As Foundry's card menu does (SetupPackages#toggleLock): its internal
 * lockPackage request, then a re-render. Behind the `lockPackage` flag.
 */
async function setLock(
  page: ActionGlobals,
  id: string,
  shouldLock: boolean,
): Promise<string | undefined> {
  const world = worldOf(page, id) as
    (WorldLike & { locked?: boolean }) | undefined;
  const game = page.game;
  if (!world || !game?.post) return `No world ${id}`;
  await game.post({ action: "lockPackage", type: "world", id, shouldLock });
  world.locked = shouldLock;
  const setup = page.ui?.setupPackages as
    { render?: () => unknown } | undefined;
  await setup?.render?.();
  return undefined;
}

/** Foundry's own uninstall: its confirm-code dialog, then Setup reloads. */
async function deleteWorld(
  page: ActionGlobals,
  id: string,
): Promise<string | undefined> {
  const world = worldOf(page, id);
  const uninstall = (
    page.game as
      { uninstallPackage?: (p: unknown) => Promise<unknown> } | undefined
  )?.uninstallPackage;
  if (!world || !uninstall) return `No world ${id}`;
  await uninstall.call(page.game, world);
  return undefined;
}

interface PickerClass {
  readonly implementation?: PickerClass;
  new (options: {
    type: string;
    current: string;
    callback: (path: string) => unknown;
  }): { render(force?: boolean): unknown };
}

/**
 * Foundry's own file picker for the world's background; the pick is saved
 * through editWorld like every About field (behind the `editWorld` flag).
 */
function pickBackground(page: ActionGlobals, id: string): string | undefined {
  const world = worldOf(page, id) as
    (WorldLike & { background?: string }) | undefined;
  const apps = (
    page.foundry?.applications as
      { apps?: { FilePicker?: PickerClass } } | undefined
  )?.apps;
  const Picker = apps?.FilePicker?.implementation ?? apps?.FilePicker;
  if (!world || !Picker) return `No world ${id}`;
  const picker = new Picker({
    type: "image",
    current: world.background ?? "",
    callback: async (path: string) => {
      const error = await saveWorld(page, id, { background: path });
      if (error) page.ui?.notifications?.error?.(error);
    },
  });
  picker.render(true);
  return undefined;
}

/** Foundry's warnings window opens under its own menu, hidden by our page. */
export const WARNINGS_ID = "setup-warnings";
const PLACE_TOP = 80;
const PLACE_TRIES = 40;

/** Moves one of Foundry's windows into view once it has rendered. */
async function placeInView(page: ActionGlobals, id: string): Promise<void> {
  for (let i = 0; i < PLACE_TRIES; i++) {
    const app = page.foundry?.applications?.instances?.get(id);
    if (app?.rendered) {
      const w = app.position?.width;
      const width = typeof w === "number" ? w : 600;
      const left = Math.max(16, Math.round((innerWidth - width) / 2));
      app.setPosition({ left, top: PLACE_TOP });
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

function openWarnings(doc: Document, page: ActionGlobals): string | undefined {
  const error = click(
    doc,
    `#setup-menu [data-action="${MENU_ACTION.warnings ?? ""}"]`,
    "warnings",
  );
  if (!error) void placeInView(page, WARNINGS_ID);
  return error;
}

export async function runFoundryAction(
  doc: Document,
  page: ActionGlobals,
  a: FoundryAction,
): Promise<string | undefined> {
  try {
    switch (a.action) {
      case "warnings":
        return openWarnings(doc, page);
      case "logout":
      case "shutdown":
        return click(
          doc,
          `#setup-menu [data-action="${MENU_ACTION[a.action]}"]`,
          a.action,
        );
      case "createWorld":
        return click(
          doc,
          '#setup-packages [data-action="worldCreate"]',
          "create world",
        );
      case "launch":
        return launch(doc, a.worldId);
      case "backupLaunch":
        return await backupThenLaunch(doc, page, a.worldId, a.note);
      case "favorite":
        return await toggleFavorite(page, a.worldId);
      case "lock":
      case "unlock":
        return await setLock(page, a.worldId, a.action === "lock");
      case "deleteWorld":
        return await deleteWorld(page, a.worldId);
      case "pickBackground":
        return pickBackground(page, a.worldId);
    }
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
