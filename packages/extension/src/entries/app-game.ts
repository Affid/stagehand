// The app's script on a server's pages, added at document start by native
// inside wrapForServer. On the server's game page it relays the companion
// module to the background (app/page.ts); on /join, while a world runs,
// it shows the app's own screen (app/running/); elsewhere it does nothing.
import { startAppGame } from "../app/page.ts";

declare const ML_APP_SERVER: string | undefined;
/** running.css, put in by build.ts. */
declare const __ML_RUNNING_CSS__: string;

if (typeof ML_APP_SERVER === "string")
  startAppGame({
    win: window,
    href: location.href,
    server: ML_APP_SERVER,
    runningCss: __ML_RUNNING_CSS__,
  });
