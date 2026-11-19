// Module Management's library view, set up from the companion's entry: the
// setting, the library read once per page for Gamemasters, and the window
// taken over on each render (window.ts), with the view's chunk and styles
// loaded only then.
import { logError } from "@stagehand/shared/log";
import type { Library } from "@stagehand/shared/library/schema";
import { type FoundryGlobals, MODULE_ID } from "../foundry.ts";
import { localPrefs } from "../view/prefs.ts";
import { askAboutBbmm, bbmmHoldsButton, registerBbmmAnswer } from "./bbmm.ts";
import { readWorldLibrary } from "./library.ts";
import {
  closeWindow,
  type ModuleWindow,
  type Mounted,
  takeOverWindow,
} from "./window.ts";

export const SETTING = "libraryView";
/** Built next to the companion's script (vite.config.ts). */
const CSS_FILE = "stagehand-view.css";
const CSS_ID = "stagehand-view-css";

export function registerSetting(g: FoundryGlobals): void {
  registerBbmmAnswer(g.game);
  g.game.settings.register(MODULE_ID, SETTING, {
    name: "STAGEHAND.Manage.SettingName",
    hint: "STAGEHAND.Manage.SettingHint",
    scope: "user",
    config: true,
    type: Boolean,
    default: true,
  });
}

function loadCss(): void {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement("link");
  link.id = CSS_ID;
  link.rel = "stylesheet";
  link.href = new URL(CSS_FILE, import.meta.url).href;
  document.head.append(link);
}

const isWindow = (app: unknown): app is ModuleWindow =>
  typeof app === "object" &&
  app !== null &&
  "options" in app &&
  "setPosition" in app;

const isFirstRender = (options: unknown): boolean =>
  typeof options === "object" &&
  options !== null &&
  "isFirstRender" in options &&
  options.isFirstRender === true;

function mounter(g: FoundryGlobals, app: ModuleWindow) {
  const { game } = g;
  return async (
    host: HTMLElement,
    library: Library,
    setReview: (review: () => void) => void,
  ): Promise<Mounted> => {
    const { mountView } = await import("../view/mount.tsx");
    return mountView(host, {
      app,
      game,
      library,
      dialog: g.foundry.applications.api.DialogV2,
      warn: (m) => {
        g.ui.notifications.warn(m);
      },
      error: (m) => {
        g.ui.notifications.error(m);
      },
      reloadAll: () => {
        reloadEveryone(g);
      },
      prefs: localPrefs(() => globalThis.localStorage, game.user?.id ?? ""),
      canSwitch: game.user?.can("SETTINGS_MODIFY") === true,
      fullGM: game.user?.role === g.CONST.USER_ROLES.GAMEMASTER,
      setReview,
    });
  };
}

/** While BBMM holds the button, our hint says how to reach this view. */
function hintForBbmm(g: FoundryGlobals): void {
  if (!bbmmHoldsButton(g.game)) return;
  const config = g.game.settings.settings?.get(`${MODULE_ID}.${SETTING}`);
  if (config) config.hint = "STAGEHAND.Manage.SettingHintBbmm";
}

function onReady(
  g: FoundryGlobals,
  my: {
    readonly isGM: () => boolean;
    readonly settingOn: () => boolean;
    readonly readLibrary: () => Promise<Library | undefined>;
  },
): void {
  hintForBbmm(g);
  if (!my.isGM() || !my.settingOn()) return;
  void my.readLibrary();
  askAboutBbmm({
    game: g.game,
    dialog: g.foundry.applications.api.DialogV2,
    info: (m) => {
      g.ui.notifications.info(m);
    },
    reloadAll: () => {
      reloadEveryone(g);
    },
    settingOn: my.settingOn,
    hasLibrary: async () => (await my.readLibrary()) !== undefined,
    loadCss,
  }).catch((error: unknown) => {
    logError("module view", error);
  });
}

/** As Foundry's own reload after a module change: every client reloads. */
function reloadEveryone(g: FoundryGlobals): void {
  g.game.socket.emit("reload");
  g.foundry.utils.debouncedReload();
}

export function registerModuleView(g: FoundryGlobals): void {
  // Read once per page; a missing or unreadable file is tried again next time.
  let library: Promise<Library | undefined> | undefined;
  const readLibrary = (): Promise<Library | undefined> =>
    (library ??= readWorldLibrary({
      fetch: (url, init) => fetch(url, init),
      route: (path) => g.foundry.utils.getRoute(path),
      log: (message) => {
        logError("module view", message);
      },
    }).then((read) => {
      if (read === undefined) library = undefined;
      return read;
    }));
  const settingOn = (): boolean =>
    g.game.settings.get(MODULE_ID, SETTING) !== false;
  const isGM = (): boolean => g.game.user?.isGM === true;
  g.Hooks.once("init", () => {
    registerSetting(g);
  });
  g.Hooks.once("ready", () => {
    onReady(g, { isGM, settingOn, readLibrary });
  });
  g.Hooks.on("renderModuleManagement", (app, element, _context, options) => {
    if (!isWindow(app) || !(element instanceof HTMLElement)) return;
    const deps = {
      isGM: isGM(),
      generation: g.game.release.generation,
      settingOn,
      library: readLibrary,
      loadCss,
      mount: mounter(g, app),
      viewportWidth: () => window.innerWidth,
      viewFailed: () => {
        g.ui.notifications.warn(
          g.game.i18n.localize("STAGEHAND.Manage.ViewFailed"),
        );
      },
    };
    takeOverWindow(deps, app, element, isFirstRender(options)).catch(
      (error: unknown) => {
        logError("module view", error);
      },
    );
  });
  g.Hooks.on("closeModuleManagement", (app) => {
    if (typeof app === "object" && app !== null) closeWindow(app);
  });
}
