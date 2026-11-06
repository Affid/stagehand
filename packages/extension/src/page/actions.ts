// Foundry actions for the new Setup page. Foundry's private flows (its menu buttons,
// a world's launch control) are reached by clicking its own hidden controls, so its
// prompts, locks and migration checks still run; the rest uses public API.
// Returns an error message, or undefined when the action was started.
import type { FoundryAction } from "../page-protocol.ts";

const MENU_ACTION: Record<string, string> = {
  configure: "configure",
  backups: "backups",
  update: "update",
  logout: "adminLogout",
  shutdown: "shutDown",
};
const FAVORITES = "setupPackageFavorites";

type Loose = Record<string, unknown>;
interface WorldLike {
  readonly id: string;
  favorite?: boolean;
}
export interface ActionGlobals {
  readonly game?: {
    readonly worlds?: { get(id: string): unknown };
    readonly settings?: {
      get(ns: string, key: string): unknown;
      set(ns: string, key: string, v: unknown): Promise<unknown>;
    };
  };
  readonly ui?: { readonly setupPackages?: unknown };
  readonly foundry?: unknown;
}

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
  const w = page.game?.worlds?.get(id) as WorldLike | undefined;
  return w && typeof w === "object" ? w : undefined;
};

function editWorld(page: ActionGlobals, id: string): string | undefined {
  const world = worldOf(page, id);
  const apps = (page.foundry as Loose | undefined)?.applications as
    Loose | undefined;
  const WorldConfig = (
    (apps?.sidebar as Loose | undefined)?.apps as Loose | undefined
  )?.WorldConfig as
    (new (o: unknown) => { render(o: unknown): unknown }) | undefined;
  if (!world) return `No world ${id}`;
  if (!WorldConfig) return "Foundry's World Configuration is missing";
  void new WorldConfig({ world }).render({ force: true });
  return undefined;
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

export async function runFoundryAction(
  doc: Document,
  page: ActionGlobals,
  a: FoundryAction,
): Promise<string | undefined> {
  try {
    switch (a.action) {
      case "configure":
      case "backups":
      case "update":
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
      case "launch": {
        const cards = [
          ...doc.querySelectorAll<HTMLElement>(
            "li.package.world[data-package-id]",
          ),
        ];
        const card = cards.find((c) => c.dataset.packageId === a.worldId);
        const control = card?.querySelector<HTMLElement>(
          '[data-action="worldLaunch"]',
        );
        if (!control)
          return `Foundry's launch control for ${a.worldId} is missing`;
        control.click();
        return undefined;
      }
      case "editWorld":
        return editWorld(page, a.worldId);
      case "favorite":
        return await toggleFavorite(page, a.worldId);
    }
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
