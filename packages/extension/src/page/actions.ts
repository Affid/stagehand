// Foundry actions for the new Setup page. Foundry's private flows (its menu buttons,
// a world's launch control) are reached by clicking its own hidden controls, so its
// prompts, locks and migration checks still run; the rest uses public API.
// Returns an error message, or undefined when the action was started.
import type { FoundryAction } from "../page-protocol.ts";
import type { PageGlobals } from "./globals.ts";
import {
  backup,
  edit,
  setLock,
  toggleFavorite,
  uninstall,
  update,
} from "./package-actions.ts";
import { saveWorld } from "./save-world.ts";
import { placeInView } from "./place.ts";

const MENU_ACTION: Record<string, string> = {
  warnings: "viewWarnings",
  logout: "adminLogout",
  shutdown: "shutDown",
};

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

/** Moves one of Foundry's windows into view once it has rendered. */

function openWarnings(doc: Document, page: ActionGlobals): string | undefined {
  const error = click(
    doc,
    `#setup-menu [data-action="${MENU_ACTION.warnings ?? ""}"]`,
    "warnings",
  );
  if (!error) void placeInView(page, WARNINGS_ID);
  return error;
}

/**
 * As Setup's Shut down (#onClickShutDownServer) after our own confirm: its
 * deferred /quit, then the page Foundry sends us to.
 */
async function quit(page: ActionGlobals): Promise<string | undefined> {
  const route = page.foundry?.utils?.getRoute?.("quit") ?? "/quit";
  const response = await fetch(route, {
    method: "POST",
    body: JSON.stringify({ defer: true }),
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) return "Foundry did not accept the shutdown";
  window.location.href = response.url;
  return undefined;
}

/** Foundry's installer (public), or its own Update All button (private flow). */
function packageAction(
  doc: Document,
  page: ActionGlobals,
  a: Extract<FoundryAction, { action: "installPackage" | "updateAll" }>,
): string | undefined {
  if (a.action === "installPackage") {
    const browse = (
      page.game as { browsePackages?: (type: string) => unknown } | undefined
    )?.browsePackages;
    if (!browse) return "Foundry's installer is missing";
    void browse.call(page.game, a.packageType);
    return undefined;
  }
  return click(
    doc,
    `#setup-packages [data-package-type="${a.packageType}"] [data-action="updateAll"]`,
    "Update All",
  );
}

/** Foundry's card-menu actions on one module or system. */
function runPackageAction(
  doc: Document,
  page: ActionGlobals,
  a: Extract<FoundryAction, { id: string }>,
): Promise<string | undefined> | string | undefined {
  switch (a.action) {
    case "updatePackage":
      return update(doc, a.packageType, a.id);
    case "favoritePackage":
      return toggleFavorite(page, a.packageType, a.id);
    case "lockPackage":
    case "unlockPackage":
      return setLock(page, a.packageType, a.id, a.action === "lockPackage");
    case "backupPackage":
      return backup(page, a.packageType, a.id);
    case "uninstallPackage":
      return uninstall(page, a.packageType, a.id);
    case "editPackage":
      return a.packageType === "module"
        ? edit(doc, page, a.id)
        : `Foundry has no editor for a ${a.packageType}`;
  }
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
      case "quit":
        return await quit(page);
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
        return await toggleFavorite(page, "world", a.worldId);
      case "lock":
      case "unlock":
        return await setLock(page, "world", a.worldId, a.action === "lock");
      case "deleteWorld":
        return await uninstall(page, "world", a.worldId);
      case "pickBackground":
        return pickBackground(page, a.worldId);
      case "installPackage":
      case "updateAll":
        return packageAction(doc, page, a);
      default:
        return await runPackageAction(doc, page, a);
    }
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
