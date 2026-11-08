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
import { pathWithinServer, serverIdOfPage } from "../background/servers.ts";
import { startGameBridge } from "../bridge/game.ts";
import { startSetupUi } from "../ui/start.ts";
import { createNativeBridge, type NativePort } from "./bridge.ts";
import { BRIDGE_NAME } from "./native-api.ts";
import { nativePorts, nativeSend } from "./platform.ts";

/** True for `page` ("/setup") or below it on `server`, route prefix included. */
export function isServerPage(
  href: string,
  server: string,
  page: string,
): boolean {
  try {
    if (serverIdOfPage(href, [server]) !== server) return false;
    const path = pathWithinServer(href, server);
    return path === page || path.startsWith(`${page}/`);
  } catch {
    return false;
  }
}

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

/** Our styles before Foundry's first paint: the veil keeps Setup hidden. */
function addStyles(doc: Document, css: string): void {
  const style = doc.createElement("style");
  style.dataset.ml = "setup";
  style.textContent = css;
  doc.documentElement.append(style);
}

/** Runs our Setup page on the server's Setup page; false when it doesn't. */
export function startAppSetup(deps: AppSetupDeps): boolean {
  if (!isServerPage(deps.href, deps.server, "/setup")) return false;
  // Taken first, before anything that could throw (security review).
  const port = takeBridge(deps.win);
  if (!port) return false;
  const { doc } = deps;
  addStyles(doc, deps.css);
  startVeil(doc);
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
}

/**
 * Relays the companion on the server's game page; false when it doesn't.
 * Native adds app-game after app-setup, so on every other page of the
 * server (/join, /auth, anything) the bridge object is taken away here and
 * no page script can use it (security review).
 */
export function startAppGame(deps: AppGameDeps): boolean {
  const port = takeBridge(deps.win);
  if (!port || !isServerPage(deps.href, deps.server, "/game")) return false;
  startGameBridge({
    send: nativeSend(createNativeBridge(port)),
    win: deps.win,
  });
  return true;
}
