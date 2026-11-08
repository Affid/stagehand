// The extension's script in the Setup page's own JavaScript world: Foundry's
// half of the Setup page (page/main.ts), talking to the isolated UI with
// window messages.
import { windowChannel } from "../page-channel.ts";
import { pageGlobals } from "../page/globals.ts";
import { startSetupMain } from "../page/main.ts";

startSetupMain({
  channel: windowChannel(window, "setup-main", "setup-ui"),
  page: pageGlobals(),
  doc: document,
});
