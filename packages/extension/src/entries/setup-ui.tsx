// The extension's isolated content script on Setup: our half of the Setup
// page (ui/start.ts), with window messages to Foundry's half, the
// background through chrome.runtime, and the browser's files, confirm and
// tabs.
import "@module-library/shared/zod-config";
import { windowChannel } from "../page-channel.ts";
import { send } from "../platform/runtime.ts";
import { browserPorts } from "../ui/ports.ts";
import { startSetupUi } from "../ui/start.ts";

startSetupUi({
  channel: windowChannel(window, "setup-ui", "setup-main"),
  send,
  ports: browserPorts(),
  doc: document,
});
