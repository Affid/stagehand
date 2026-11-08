// The background in the app: the same router, state and library as the
// extension's service worker, in a hidden page on the app's own origin.
// Native carries every page's runtime messages here as `route`, with the
// sender attached (native-api.ts); everything else goes back to native over
// the bridge.
import type { SetupConfig } from "../adapters/config.ts";
import { loadSetupConfig } from "../adapters/remote.ts";
import { serialized } from "../background/kv.ts";
import { route, type RouterDeps } from "../background/router.ts";
import { createState } from "../background/state.ts";
import type { NativeBridge } from "./bridge.ts";
import {
  APP_ID,
  APP_URL,
  READY,
  ROUTE,
  RoutePayloadSchema,
} from "./native-api.ts";
import {
  nativeFetch,
  nativeKeyValue,
  nativeReleases,
  nativeScripting,
} from "./platform.ts";

export interface AppInfo {
  /** The app's version, as the extension's manifest version. */
  readonly version: string;
}

/** One home screen at a time: a page can't keep opening it (as the extension). */
export const HOME_GAP_MS = 2000;

/** Opens the home screen, at most once every HOME_GAP_MS. */
function homeOpener(bridge: NativeBridge): () => Promise<void> {
  let openedAt = -Infinity;
  return async () => {
    if (Date.now() - openedAt < HOME_GAP_MS) return;
    openedAt = Date.now();
    await bridge.request("home.open", {});
  };
}

export function nativeRouterDeps(
  bridge: NativeBridge,
  app: AppInfo,
): RouterDeps {
  const kv = nativeKeyValue(bridge);
  let config: Promise<SetupConfig> | undefined;
  return {
    state: createState(serialized(kv)),
    scripting: nativeScripting(bridge),
    releases: nativeReleases(bridge),
    openSettings: homeOpener(bridge),
    extensionId: APP_ID,
    extensionUrl: APP_URL,
    extensionVersion: app.version,
    loadConfig: () => {
      config ??= loadSetupConfig({
        kv,
        fetchText: nativeFetch(bridge, "config"),
        now: Date.now,
      }).catch((error: unknown) => {
        // Storage failed: tried again next time, not cached (review).
        config = undefined;
        throw error;
      });
      return config;
    },
    now: () => new Date().toISOString(),
    uuid: () => crypto.randomUUID(),
  };
}

/**
 * Answers native's `route` requests with the router's answer, then tells
 * native it is ready: WebView lets native answer a page only once the page
 * has written first, and `route` is handled only from here on (review).
 */
export async function serveBackground(
  bridge: NativeBridge,
  deps: RouterDeps,
): Promise<void> {
  bridge.handle(ROUTE, (payload) => {
    const { message, sender } = RoutePayloadSchema.parse(payload);
    return route(deps, message, sender);
  });
  await bridge.request(READY, {});
}
