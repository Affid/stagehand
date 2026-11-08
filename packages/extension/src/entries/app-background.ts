// The app's hidden background page (background.html on the app's own
// origin): the extension's router, state and library, over native.
import "@module-library/shared/zod-config";
import { logError } from "@module-library/shared/log";
import { nativeRouterDeps, serveBackground } from "../app/background.ts";
import { createNativeBridge } from "../app/bridge.ts";
import { takeBridge } from "../app/page.ts";
import { restoreServers } from "../background/router.ts";

/** The app's version, put in by build.ts. */
declare const __ML_VERSION__: string;

const port = takeBridge(window);
if (port) {
  const bridge = createNativeBridge(port);
  const deps = nativeRouterDeps(bridge, { version: __ML_VERSION__ });
  serveBackground(bridge, deps).catch((error: unknown) => {
    logError("background", error);
  });
  // Each start: scripts native lost are put back, as in the extension.
  restoreServers(deps).catch((error: unknown) => {
    logError("background", error);
  });
} else logError("background", new Error("No bridge to native"));
