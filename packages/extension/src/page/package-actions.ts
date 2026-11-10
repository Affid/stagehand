// Foundry's own package actions, for worlds, modules and systems alike, as
// its card menu runs them (SetupPackages): the favourite setting, its
// internal lockPackage request (behind the lockPackage flag), its update,
// backup and uninstall flows with their own dialogs.
import type { PageGlobals } from "./globals.ts";
import { quirksFor } from "../compat/quirks.ts";
import { redrawSetup } from "./redraw.ts";
import { placeInView } from "./place.ts";

export type PackageType = "world" | "module" | "system";
export type ActionGlobals = Pick<PageGlobals, "game" | "ui" | "foundry">;

const FAVORITES = "setupPackageFavorites";
const COLLECTION: Record<PackageType, "worlds" | "modules" | "systems"> = {
  world: "worlds",
  module: "modules",
  system: "systems",
};

interface PackageLike {
  readonly id: string;
  favorite?: boolean;
  locked?: boolean;
}

interface PackageGame {
  createBackup?: (pkg: unknown, o: { dialog: boolean }) => Promise<unknown>;
  uninstallPackage?: (pkg: unknown) => Promise<unknown>;
}

export function packageOf(
  page: ActionGlobals,
  type: PackageType,
  id: string,
): PackageLike | undefined {
  const p = page.game?.[COLLECTION[type]]?.get?.(id) as PackageLike | undefined;
  return p && typeof p === "object" ? p : undefined;
}

/** As SetupPackages#toggleFavorite: Foundry's setting, then a re-render. */
export async function toggleFavorite(
  page: ActionGlobals,
  type: PackageType,
  id: string,
): Promise<string | undefined> {
  const pkg = packageOf(page, type, id);
  const settings = page.game?.settings;
  if (!pkg || !settings) return `No ${type} ${id}`;
  const key = COLLECTION[type];
  const current = (settings.get("core", FAVORITES) ?? {}) as Record<
    string,
    readonly string[]
  >;
  const ids = current[key] ?? [];
  const next = {
    ...current,
    [key]: pkg.favorite ? ids.filter((x) => x !== id) : [...ids, id],
  };
  await settings.set("core", FAVORITES, next);
  pkg.favorite = !pkg.favorite;
  await redrawSetup(page, "package");
  return undefined;
}

/** As SetupPackages#toggleLock: its internal lockPackage request. */
export async function setLock(
  page: ActionGlobals,
  type: PackageType,
  id: string,
  shouldLock: boolean,
): Promise<string | undefined> {
  const pkg = packageOf(page, type, id);
  const game = page.game;
  if (!pkg || !game?.post) return `No ${type} ${id}`;
  await game.post({ action: "lockPackage", type, id, shouldLock });
  pkg.locked = shouldLock;
  await redrawSetup(page, "package");
  return undefined;
}

/** Foundry's own uninstall: its confirm-code dialog, then Setup reloads. */
export async function uninstall(
  page: ActionGlobals,
  type: PackageType,
  id: string,
): Promise<string | undefined> {
  const pkg = packageOf(page, type, id);
  const run = (page.game as PackageGame | undefined)?.uninstallPackage;
  if (!pkg || !run) return `No ${type} ${id}`;
  await run.call(page.game, pkg);
  return undefined;
}

/** Foundry's own backup, with its note dialog, lock and progress. */
export async function backup(
  page: ActionGlobals,
  type: PackageType,
  id: string,
): Promise<string | undefined> {
  const pkg = packageOf(page, type, id);
  const run = (page.game as PackageGame | undefined)?.createBackup;
  if (!pkg || !run) return `No ${type} ${id}`;
  await run.call(page.game, pkg, { dialog: true });
  return undefined;
}

/** Foundry's own update of one package: its hidden card's update control. */
export function update(
  doc: Document,
  type: PackageType,
  id: string,
): string | undefined {
  const cards = [
    ...doc.querySelectorAll<HTMLElement>(
      `#setup-packages [data-package-type="${type}"] li.package[data-package-id]`,
    ),
  ];
  const control = cards
    .find((c) => c.dataset.packageId === id)
    ?.querySelector<HTMLElement>('[data-action="updatePackage"]');
  if (!control) return `Foundry's update control for ${id} is missing`;
  control.click();
  return undefined;
}

/** Foundry's module editor (ModuleConfig) is only reachable from its card menu. */
const EDITOR_ID = "module-config";
const MENU_WAIT_MS = 50;
const MENU_TRIES = 20;
/** Where the hidden menu is asked to open; it closes once its item is picked. */
const MENU_AT = 50;

/**
 * As Foundry's card menu "Edit Module": its own menu on its hidden card,
 * its edit item picked by icon (any language), then the window in view.
 */
export async function edit(
  doc: Document,
  page: ActionGlobals,
  id: string,
): Promise<string | undefined> {
  const card = [
    ...doc.querySelectorAll<HTMLElement>(
      '#setup-packages [data-package-type="module"] li.package[data-package-id]',
    ),
  ].find((c) => c.dataset.packageId === id);
  if (!card) return `Foundry's card for ${id} is missing`;
  // Foundry's menu opens only for a right-click with a position (seen live).
  card.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: MENU_AT,
      clientY: MENU_AT,
    }),
  );
  for (let i = 0; i < MENU_TRIES; i++) {
    const item = doc
      .querySelector(
        `#context-menu .context-item ${quirksFor(page.game?.release?.generation).editModuleIcon}`,
      )
      ?.closest<HTMLElement>(".context-item");
    if (item) {
      item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      item.click();
      // Foundry leaves its hidden card's menu open: close it as a click away would.
      doc.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true }),
      );
      doc.querySelector("#context-menu")?.remove();
      await placeInView(page, EDITOR_ID);
      return undefined;
    }
    await new Promise((r) => setTimeout(r, MENU_WAIT_MS));
  }
  return "Foundry's Edit Module is missing";
}
