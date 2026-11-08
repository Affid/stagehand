// The app's script on a server's pages, added at document start by native
// inside wrapForServer. On the server's game page it relays the companion
// module to the background (app/page.ts); elsewhere it does nothing.
import { startAppGame } from "../app/page.ts";

declare const ML_APP_SERVER: string | undefined;

if (typeof ML_APP_SERVER === "string")
  startAppGame({ win: window, href: location.href, server: ML_APP_SERVER });
