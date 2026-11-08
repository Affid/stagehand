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
import { createNativeBridge, type NativePort } from "./bridge.ts";
import { BRIDGE_NAME, isServerPage } from "./native-api.ts";
import { nativePorts, nativeSend } from "./platform.ts";
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
}

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
  whenRoot(doc, (root) => {
    addStyles(root, deps.css);
    startVeil(doc);
  });
  try {
    const bridge = createNativeBridge(port);
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
  /** The page it came from (the running-world screen skips a launch's /join). */
  readonly referrer?: string;
  /** running.css, for the running-world screen. */
  readonly runningCss?: string;
}

/** The server's own URL for a route under it. */
const routeOf =
  (server: string) =>
  (path: string): string =>
    `${server.replace(/\/$/, "")}/${path}`;

/**
 * Relays the companion on the server's game page; false when it doesn't.
 * Native adds app-game after app-setup, so on every other page of the
 * server (/join, /auth, anything) the bridge object is taken away here and
 * no page script can use it (security review).
 */
export function startAppGame(deps: AppGameDeps): boolean {
  const port = takeBridge(deps.win);
  if (
    port &&
    deps.runningCss !== undefined &&
    showsRunning(deps.href, deps.referrer ?? "", deps.server)
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
      });
    });
    return false;
  }
  if (!port || !isServerPage(deps.href, deps.server, "/game")) return false;
  startGameBridge({
    send: nativeSend(createNativeBridge(port)),
    win: deps.win,
  });
  return true;
}
