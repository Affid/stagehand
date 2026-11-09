// The app's scripts in the user's Foundry pages, added by native at document
// start for each saved server (wrapForServer). On the server's Setup page,
// app-setup runs both halves of our Setup page in one closure over the
// private channel; on its game page, app-game relays the companion. Both
// keep WebView's bridge object and take its global name away first, so
// Foundry's later scripts can't reach it (Android spike, Q5).
import { liftVeil, startVeil } from "../page/veil.ts";
import { localChannelPair } from "../page-channel.ts";
import { pageGlobals } from "../page/globals.ts";
import { startSetupMain } from "../page/main.ts";
import { startGameBridge } from "../bridge/game.ts";
import { startSetupUi } from "../ui/start.ts";
import {
  createNativeBridge,
  type NativeBridge,
  type NativePort,
} from "./bridge.ts";
import { BACK, BRIDGE_NAME, HOME_PAGE, isServerPage } from "./native-api.ts";
import { pressBack } from "../ui/shell/phone/back.ts";
import { hideResolutionNotice } from "../page/resolution.ts";
import { allowTextMenus, hintPasswords } from "../page/text-fields.ts";
import { addLoginBar } from "./login-bar.ts";
import { applyWatcher } from "./apply-game.ts";
import { nativePassword, nativePorts, nativeSend } from "./platform.ts";
import { showsRunning, startRunning } from "./running/start.tsx";

const isPort = (value: unknown): value is NativePort =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { postMessage?: unknown }).postMessage === "function";

/**
 * WebView's bridge object, kept here and no longer reachable by its name.
 * Undefined when there is none, or when its name can't be taken away (then
 * nothing of ours uses it either: security review).
 */
export function takeBridge(win: Window): NativePort | undefined {
  const holder = win as unknown as Record<string, unknown>;
  const port = holder[BRIDGE_NAME];
  if (!(BRIDGE_NAME in holder)) return undefined;
  if (!Reflect.deleteProperty(holder, BRIDGE_NAME)) {
    try {
      holder[BRIDGE_NAME] = undefined;
    } catch {
      // Neither deleted nor overwritten: refused below.
    }
  }
  if (holder[BRIDGE_NAME] !== undefined) return undefined;
  return isPort(port) ? port : undefined;
}

export interface AppSetupDeps {
  readonly win: Window;
  readonly doc: Document;
  readonly href: string;
  readonly server: string;
  /** The Setup page's styles, veil included (setup-ui.css). */
  readonly css: string;
  /** Clears Foundry's window-size notice (clearSizeNotice); a touch screen only. */
  readonly clearNotice?: (win: Window) => void;
}

/** A touch screen: the app always shows its phone or tablet layout there. */
const touchScreen = (win: Window): boolean =>
  win.matchMedia("(pointer: coarse)").matches;

/**
 * Runs `fn` once the document has its root element: at document start it
 * may not yet (Chromium), and a mutation callback still runs before the
 * first paint.
 */
export function whenRoot(doc: Document, fn: (root: HTMLElement) => void): void {
  const root = doc.documentElement as HTMLElement | null;
  if (root) {
    fn(root);
    return;
  }
  const observer = new MutationObserver(() => {
    const found = doc.documentElement as HTMLElement | null;
    if (!found) return;
    observer.disconnect();
    fn(found);
  });
  observer.observe(doc, { childList: true });
}

/** Runs `fn` once the document has its body (at document start it may not). */
function whenBody(doc: Document, fn: () => void): void {
  const body = (): HTMLElement | null => doc.querySelector("body");
  if (body()) {
    fn();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!body()) return;
    observer.disconnect();
    fn();
  });
  observer.observe(doc, { childList: true, subtree: true });
}

/** Our styles before Foundry's first paint: the veil keeps Setup hidden. */
function addStyles(root: HTMLElement, css: string): void {
  const style = root.ownerDocument.createElement("style");
  style.dataset.ml = "setup";
  style.textContent = css;
  root.append(style);
}

/** Runs our Setup page on the server's Setup page; false when it doesn't. */
export function startAppSetup(deps: AppSetupDeps): boolean {
  if (!isServerPage(deps.href, deps.server, "/setup")) return false;
  // Taken first, before anything that could throw (security review).
  const port = takeBridge(deps.win);
  if (!port) return false;
  const { doc } = deps;
  allowTextMenus(deps.win);
  // The phone and tablet layouts are made for the small window: Foundry's
  // notice goes from the start, not once our page is up (owner, 2026-11-09).
  if (touchScreen(deps.win)) (deps.clearNotice ?? clearSizeNotice)(deps.win);
  whenRoot(doc, (root) => {
    addStyles(root, deps.css);
    startVeil(doc);
  });
  try {
    const bridge = createNativeBridge(port);
    bridge.handle(BACK, () => ({ handled: pressBack(doc) }));
    const [main, ui] = localChannelPair();
    startSetupMain({ channel: main, page: pageGlobals(), doc });
    startSetupUi({
      channel: ui,
      send: nativeSend(bridge),
      ports: nativePorts(bridge),
      doc,
    });
  } catch (error: unknown) {
    liftVeil(doc);
    throw error;
  }
  return true;
}

export interface AppGameDeps {
  readonly win: Window;
  readonly href: string;
  readonly server: string;
  /** running.css, for the running-world screen. */
  readonly runningCss?: string;
  /** Clears Foundry's window-size notice on /join and /auth (clearSizeNotice). */
  readonly clearNotice?: (win: Window) => void;
}

/**
 * Foundry's /join and /auth at phone width: its "window smaller than
 * 1024×768" notice lies over the Join button and the password field, and
 * a launch from the app passes through /join (Android spike, finding 3).
 * Taken away as on Setup.
 */
export function clearSizeNotice(win: Window): void {
  // From document start: the notice goes as soon as Foundry adds it.
  hideResolutionNotice(pageGlobals(), win.document);
}

/** The server's own URL for a route under it. */
const routeOf =
  (server: string) =>
  (path: string): string =>
    `${server.replace(/\/$/, "")}/${path}`;

/** The game page: the companion's relay, watched while applying out of sight (phase 7). */
function startGamePage(port: NativePort, win: Window): void {
  const bridge = createNativeBridge(port);
  const watch = applyWatcher({
    store: win.sessionStorage,
    done: async (ok) => {
      await bridge.request("apply.done", { ok });
    },
  });
  startGameBridge({
    send: nativeSend(bridge),
    win,
    ...(watch ? { watch } : {}),
  });
}

/** What our running page asks of native: a password, applying out of sight. */
function runningNative(bridge: NativeBridge) {
  return {
    askPassword: nativePassword(bridge),
    applyAllowed: async (world: string): Promise<boolean> => {
      const reply = await bridge.request("apply.allowed", { world });
      return (reply as { allowed?: unknown } | null)?.allowed === true;
    },
    startApply: async (
      world: string,
      title: string,
      changes: number,
    ): Promise<void> => {
      await bridge.request("apply.start", { world, title, changes });
    },
  };
}

/**
 * Relays the companion on the server's game page; false when it doesn't.
 * Native adds app-game after app-setup, so on every other page of the
 * server (/join, /auth, anything) the bridge object is taken away here and
 * no page script can use it (security review).
 */
export function startAppGame(deps: AppGameDeps): boolean {
  const port = takeBridge(deps.win);
  // Every page of the server but Setup (app-setup took the bridge there).
  if (port) allowTextMenus(deps.win);
  if (
    port &&
    deps.runningCss !== undefined &&
    showsRunning(deps.href, deps.server)
  ) {
    const doc = deps.win.document;
    const css = deps.runningCss;
    whenRoot(doc, () => {
      startRunning({
        win: deps.win,
        doc,
        css,
        game: () => (deps.win as { game?: unknown }).game,
        server: {
          fetch: deps.win.fetch.bind(deps.win),
          route: routeOf(deps.server),
        },
        serversHref: HOME_PAGE,
        notes: deps.win.sessionStorage,
        // The bridge stays ours: a password from native's sheet, and the
        // hand-over to native for applying the changes out of sight.
        ...runningNative(createNativeBridge(port)),
      });
    });
    return false;
  }
  const onLoginPage = ["/join", "/auth"].some((p) =>
    isServerPage(deps.href, deps.server, p),
  );
  if (port && onLoginPage) {
    (deps.clearNotice ?? clearSizeNotice)(deps.win);
    hintPasswords(deps.win.document);
    if (isServerPage(deps.href, deps.server, "/auth"))
      whenBody(deps.win.document, () => {
        addLoginBar(deps.win.document, deps.server, HOME_PAGE);
      });
    return false;
  }
  if (!port || !isServerPage(deps.href, deps.server, "/game")) return false;
  startGamePage(port, deps.win);
  return true;
}
