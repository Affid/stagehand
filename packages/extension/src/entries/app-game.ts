// The app's script on a server's pages, added at document start by native
// inside wrapForServer. On the server's game page it watches the companion
// apply a launch's changes out of sight (app/page.ts); on /join, while a world runs,
// it shows the app's own screen (app/running/); elsewhere it does nothing.
import { startAppGame } from "../app/page.ts";

declare const ST_APP_SERVER: string | undefined;
/** running.css, put in by build.ts. */
declare const __ST_RUNNING_CSS__: string;

if (typeof ST_APP_SERVER === "string")
  startAppGame({
    win: window,
    href: location.href,
    server: ST_APP_SERVER,
    runningCss: __ST_RUNNING_CSS__,
  });
