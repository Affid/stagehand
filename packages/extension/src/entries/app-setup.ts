// The app's script on a server's pages, added at document start by native
// inside wrapForServer, which supplies ST_APP_SERVER. On the server's
// Setup page it runs our Setup page (app/page.ts); elsewhere it does
// nothing.
import "@stagehand/shared/zod-config";
import { startAppSetup } from "../app/page.ts";

declare const ST_APP_SERVER: string | undefined;
/** setup-ui.css, put in by build.ts. */
declare const __ST_SETUP_CSS__: string;

if (typeof ST_APP_SERVER === "string")
  startAppSetup({
    win: window,
    doc: document,
    href: location.href,
    server: ST_APP_SERVER,
    css: __ST_SETUP_CSS__,
  });
