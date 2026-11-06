// Foundry actions for the new Setup page. Foundry's private flows (its menu buttons,
// a world's launch control) are reached by clicking its own hidden controls, so its
// prompts, locks and migration checks still run; the rest uses public API.
// Returns an error message, or undefined when the action was started.
import type { FoundryAction } from "../page-protocol.ts";
import type { PageGlobals } from "./globals.ts";

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
    }
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
