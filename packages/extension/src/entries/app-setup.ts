// The app's script on a server's pages, added at document start by native
// inside wrapForServer, which supplies ML_APP_SERVER. On the server's
// Setup page it runs our Setup page (app/page.ts); elsewhere it does
// nothing.
import "@module-library/shared/zod-config";
import { startAppSetup } from "../app/page.ts";

declare const ML_APP_SERVER: string | undefined;
/** setup-ui.css, put in by build.ts. */
declare const __ML_SETUP_CSS__: string;

if (typeof ML_APP_SERVER === "string")
  startAppSetup({
    win: window,
    doc: document,
    href: location.href,
    server: ML_APP_SERVER,
    css: __ML_SETUP_CSS__,
  });
