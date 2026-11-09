// What the app's pages ask of native, and what native asks of them: the
// contract between this TypeScript and the Kotlin app (phase 4), and the
// harness that plays native in tests. Transport: bridge.ts.
//
// Three kinds of page talk to native, each in its own WebView:
// - "server": the user's Foundry pages with app-setup.js or app-game.js;
// - "home": the app's home screen (server list, Release history);
// - "background": the hidden page running the router, state and library.
// Native knows which WebView a message came from and refuses any request
// that page may not make (CALLER_REQUESTS); the pages never say who they
// are. Payloads: native-requests.ts. What native must check besides:
// docs/ANDROID-APP-PLAN.md, "Native rules".
//
// Nothing a page sends is a trust decision: our scripts share the page's
// world with Foundry's, so a hostile server's script can forge what they
// send and read what they get (Android plan, "Security"). The background
// authorises by the sender native attaches; confirm and the file picker
// are the user's convenience, not a gate.
import { z } from "zod";
import { REMOTE_CONFIG_URL } from "../adapters/config.ts";
import { RELEASES_URL } from "../background/releases.ts";
import { pathWithinServer, serverIdOfPage } from "../background/servers.ts";

/** The app's own pages, served by WebViewAssetLoader. */
export const APP_ORIGIN = "https://appassets.androidplatform.net";
/** RouterDeps.extensionUrl: messages from pages under it are the app's own. */
export const APP_URL = `${APP_ORIGIN}/`;
/** RouterDeps.extensionId; native attaches it to every message it relays. */
export const APP_ID = "module-library-app";
export const BACKGROUND_PAGE = `${APP_URL}background.html`;
export const HOME_PAGE = `${APP_URL}home.html`;

/** The name WebView gives the bridge object (`addWebMessageListener`). */
export const BRIDGE_NAME = "mlApp";

/**
 * A page script as native adds it for one server: wrapped in a function
 * whose parameter ML_APP_SERVER is the server's address, so the script
 * knows the route prefix and its own names stay out of the page.
 */
export function wrapForServer(script: string, server: string): string {
  return `(function (ML_APP_SERVER) {\n${script}\n})(${JSON.stringify(server)});\n`;
}

/**
 * Server pages may make "server" requests only from a saved server's
 * Setup or game page (native checks the WebView's current URL); on its other
 * pages (/join, /auth) the bridge object stays unused.
 */
export type Caller = "server" | "running" | "home" | "background";

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

/** Paths native refuses before comparing (plan, "Native rules"). */
export const ODD_PATH = /%|\\|\.\.|\/\/|\p{Cc}/u;

/** The path of an http(s) URL as written (before any parser tidies it). */
const RAW_PATH = /^https?:\/\/[^/?#\\]*([^?#]*)/i;

/**
 * Whether a page at `url` may make "server" requests: a saved server's
 * Setup or game page, and no odd path (as written or as parsed). `servers`
 * are the saved servers whose origins native allows.
 */
export function mayAskAsServer(
  url: string,
  servers: readonly string[],
): boolean {
  const raw = RAW_PATH.exec(url);
  if (!raw || ODD_PATH.test(raw[1] ?? "")) return false;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  if (ODD_PATH.test(path)) return false;
  return servers.some(
    (s) => isServerPage(url, s, "/setup") || isServerPage(url, s, "/game"),
  );
}

/** The longest outside link native opens. */
export const MAX_EXTERNAL_URL = 4096;

/** The longest password native hands back. */
const MAX_PASSWORD = 4096;

/**
 * Whether native opens `url` outside the app (a Custom Tab): http or https
 * written out with "//", a host, no user info, not too long, and not one of
 * the saved servers' own origins (those stay in the app).
 */
export function externalAllowed(
  url: string,
  serverOrigins: readonly string[],
): boolean {
  if (url.length > MAX_EXTERNAL_URL || !/^https?:\/\//i.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password || !parsed.hostname) return false;
  return !serverOrigins.includes(parsed.origin);
}

/** Hosts never saved as a server: the app's own and Foundry's site. */
const NEVER_SERVERS = [new URL(APP_ORIGIN).hostname, "foundryvtt.com"];

/** A server's match pattern, "http://host:port/*" (native-requests.ts). */
const SERVER_PATTERN = /^https?:\/\/[^/*?#\\@\s]+\/\*$/;

/**
 * The origin a server's match pattern allows, or undefined when native
 * must not save it: not a pattern, the app's own origin, or foundryvtt.com
 * and its subdomains (Release history has its own switch).
 */
export function savableServerOrigin(pattern: string): string | undefined {
  if (!SERVER_PATTERN.test(pattern)) return undefined;
  let url: URL;
  try {
    url = new URL(pattern.slice(0, -1));
  } catch {
    return undefined;
  }
  // A trailing dot names the same host (foundryvtt.com.): review.
  const host = url.hostname.replace(/\.$/, "");
  if (NEVER_SERVERS.some((h) => host === h || host.endsWith(`.${h}`)))
    return undefined;
  return url.origin;
}

/**
 * Requests to native and who may make them. Payloads and results:
 *
 * - runtime.send {message} → the background's answer to `route`, or its
 *   error. Native relays it as `route` with the sender attached, and owns
 *   the time limit (ROUTE_TIMEOUT_MS); the page waits for native.
 * - files.save {fileName, text} → null, once saved (system file picker).
 * - files.open {} → {text?}: the file the user picked, or none.
 * - confirm {text} → {yes}: a native dialog, one at a time (a second while
 *   one is open is answered {yes: false}).
 * - password.ask {purpose, world, user?, people, wrong} → {password} or {}
 *   when cancelled: a native sheet whose field password managers fill for
 *   the asking page's server (phase 7). Native writes the words from the
 *   purpose ("close" a world, "join" as `user` to apply changes); the page
 *   passes no text of its own. Our running page only (no module runs on
 *   /join; security review). One at a time; only on a tap on the page, or
 *   as one retry (`wrong`) within PASSWORD_RETRY_MS of a typed answer.
 * - launch.mark {world, changes} → null (a saved server's Setup only): our
 *   Setup launches `world` with queued changes; native records it for
 *   LAUNCH_KEEP_MS. Applying out of sight needs this record, so a note in
 *   the page's storage alone can start nothing (security review).
 * - apply.allowed {world} → {allowed} (our running page only): whether a
 *   recorded launch of `world` on this server waits to be applied.
 * - apply.start {world, title, changes} → null (our running page only):
 *   uses the recorded launch up; native covers the server WebView with its
 *   Applying screen (titled `title`) and lets this server's /game load
 *   behind it, for APPLY_MAX_MS at most (phase 7).
 * - apply.done {ok} → null (that server's game page only): the cover goes
 *   and the server WebView goes back to /join, our running page.
 * - openExternal {url} → null: a Custom Tab; http(s) only, never the
 *   server's own origin, only within a moment of the user's tap, and at
 *   most one a second.
 * - kv.get {key} → {value} or {} when unset (never null); kv.set {key,
 *   value} → null. App-private storage, kept across restarts.
 * - scripts.registered {ids} → string[] of those registered.
 * - scripts.register {server, ids} → null: from now on, inject
 *   app-setup.js, then app-game.js (each wrapForServer'd) into `server`'s
 *   pages, only if its origin is saved; the ids are remembered for
 *   scripts.registered. Kept across restarts; the background also
 *   re-registers on each start (restoreServers).
 * - scripts.unregister {ids} → null.
 * - permissions.contains {origin} → boolean. `origin` is a match pattern
 *   as the extension's: "http://host:port/*" (permissionOrigin) for a
 *   saved server, FOUNDRY_ORIGIN for Release history.
 * - permissions.request {origin} → boolean: adding a server in the app is
 *   the consent; FOUNDRY_ORIGIN turns Release history on.
 * - permissions.remove {origin} → boolean.
 * - fetch {url, purpose} → {text}: NativeFetch (fetchAllowed). Refused
 *   with an error: a URL the rule doesn't allow, any redirect, a status
 *   other than 2xx ("HTTP 404"), more than FETCH_MAX_CHARS, longer than
 *   FETCH_TIMEOUT_MS. Never with cookies.
 * - server.check {server} → {version}: whether Foundry answers at a server
 *   id the user typed on the home screen, saved or not. Native GETs
 *   statusUrl(server) as NativeFetch does (no redirects, no cookies, 2xx),
 *   within STATUS_TIMEOUT_MS and STATUS_MAX_CHARS, and answers only the
 *   version foundryVersion reads; anything else is an error.
 * - home.open {} → null: shows the home screen.
 * - background.ready {} → null: the background serves `route` from now
 *   on; native holds `route` requests until then, and again after the
 *   background page reloads.
 *
 * Native also caps every message at MAX_MESSAGE_CHARS (bridge.ts), accepts
 * them only from the main frame, and makes "server" requests only from a
 * saved server's Setup or game page ("running" ones only from its /join).
 */
export const CALLER_REQUESTS: Readonly<Record<Caller, readonly string[]>> = {
  server: [
    "runtime.send",
    "files.save",
    "files.open",
    "confirm",
    "openExternal",
    "launch.mark",
    "apply.done",
  ],
  // Our running page on a saved server's /join: a password, and applying
  // the launch's changes out of sight.
  running: ["password.ask", "apply.allowed", "apply.start"],
  home: [
    "runtime.send",
    "permissions.contains",
    "permissions.request",
    "permissions.remove",
    "server.check",
  ],
  background: [
    "kv.get",
    "kv.set",
    "scripts.registered",
    "scripts.register",
    "scripts.unregister",
    "permissions.contains",
    "permissions.remove",
    "fetch",
    "home.open",
    "background.ready",
  ],
};

/**
 * Native's one request to a server's Setup page: Android's Back. Answered
 * {handled}: true when the page used it (a dialog, menu or sheet closed, or
 * a page went back), false to let native go back in history or home.
 */
export const BACK = "back";

/** The background's first request: it serves `route` from now on. */
export const READY = "background.ready";

/** How long native waits for the background's answer to `route`. */
export const ROUTE_TIMEOUT_MS = 120_000;

/** Native's one request to the background page. */
export const ROUTE = "route";

/** Who sent a runtime message, as native attaches it (never from the page). */
export const SenderSchema = z.object({
  /** APP_ID for the app's own WebViews; nothing else is relayed. */
  id: z.string().max(200),
  /** The sending WebView's current main-frame URL. */
  url: z.string().max(4096),
  /** True for the server WebView (a Foundry page), false for home. */
  fromTab: z.boolean(),
});

export const RoutePayloadSchema = z.object({
  message: z.unknown(),
  sender: SenderSchema,
});

export type RoutePayload = z.infer<typeof RoutePayloadSchema>;

export const KvGetResultSchema = z.object({ value: z.unknown().optional() });
export const FilesOpenResultSchema = z.object({
  text: z.string().optional(),
});
export const ConfirmResultSchema = z.object({ yes: z.boolean() });
/** password.ask's answer: the password, or none when cancelled. */
export const PasswordResultSchema = z.object({
  password: z.string().max(MAX_PASSWORD).optional(),
});
/** A wrong password's retry may follow the last answer by this much (native's rule). */
export const PASSWORD_RETRY_MS = 10_000;
/** The longest the app applies out of sight before giving up (native's cover). */
export const APPLY_MAX_MS = 4 * 60_000;
export const FetchResultSchema = z.object({ text: z.string() });
/** Longer than any Foundry version ("14.370", "13.351-beta.2"). */
export const MAX_VERSION = 40;
export const CheckResultSchema = z.object({
  version: z.string().max(MAX_VERSION),
});
export const IdsResultSchema = z.array(z.string().max(300)).max(1000);

export type FetchPurpose = "release" | "config";

/**
 * NativeFetch: the only two kinds of outside URL the background reads.
 * Native checks them again (fetchAllowed, with its own Release history
 * state), never follows a redirect, sends no cookies or Referer, takes 2xx
 * only, and stops reading past FETCH_MAX_CHARS or FETCH_TIMEOUT_MS.
 */
export const FETCH_MAX_CHARS = 2_000_000;
export const FETCH_TIMEOUT_MS = 15_000;

/**
 * Whether native may fetch `url` for `purpose` (the rule Kotlin mirrors):
 * a release page or the list under RELEASES_URL while Release history is
 * allowed, or exactly the remote Setup config.
 */
export function fetchAllowed(
  url: string,
  purpose: FetchPurpose,
  releaseHistoryAllowed: boolean,
): boolean {
  if (purpose === "config") return url === REMOTE_CONFIG_URL;
  if (!releaseHistoryAllowed || !url.startsWith(RELEASES_URL)) return false;
  // Nothing that could step out of the path: no query, fragment or dots.
  const rest = url.slice(RELEASES_URL.length);
  return /^[0-9A-Za-z.-]*$/.test(rest) && !rest.includes("..");
}

/** server.check's limits: a status answer is a few dozen characters. */
export const STATUS_MAX_CHARS = 64_000;
export const STATUS_TIMEOUT_MS = 5_000;

/**
 * The address server.check reads for a server id (native-requests.ts
 * checks its shape): its /api/status, unless native never saves its origin
 * (the app's own, foundryvtt.com).
 */
export function statusUrl(server: string): string | undefined {
  let origin: string;
  try {
    origin = new URL(server).origin;
  } catch {
    return undefined;
  }
  return savableServerOrigin(`${origin}/*`)
    ? `${server}/api/status`
    : undefined;
}

const VERSION = /^[0-9A-Za-z.-]+$/;

/** Foundry's version from its /api/status answer, or undefined: not Foundry. */
export function foundryVersion(body: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return undefined;
  const version = (parsed as Record<string, unknown>).version;
  return typeof version === "string" &&
    version.length <= MAX_VERSION &&
    VERSION.test(version)
    ? version
    : undefined;
}
