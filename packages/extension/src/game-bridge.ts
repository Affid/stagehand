// Isolated content script on the game page: relays between the companion
// module (page JavaScript, over window.postMessage) and the background.
// No Foundry logic here (PRD 6).
import { logError } from "@module-library/shared/log";
import {
  type Envelope,
  isEnvelope,
  makeEnvelope,
  PROTOCOL_VERSIONS,
} from "@module-library/shared/protocol";
import { send } from "./runtime.ts";

const init = send<{ enabled: boolean; extensionVersion: string }>({
  kind: "bridge-init",
});

async function relay(msg: Envelope): Promise<void> {
  const { enabled } = await init;
  if (!enabled) return;
  const reply = await send<Envelope>({ kind: "relay", msg });
  window.postMessage(reply, location.origin);
}

// Listening at once: the module may say HELLO before the background answers.
window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (!isEnvelope(event.data, "module")) return;
  relay(event.data).catch((error: unknown) => {
    logError("bridge", error);
  });
});

init.then(
  ({ enabled, extensionVersion }) => {
    if (!enabled) return;
    const ready = makeEnvelope("bridge", "BRIDGE_READY", {
      extensionVersion,
      protocol: PROTOCOL_VERSIONS,
    });
    window.postMessage(ready, location.origin);
  },
  (error: unknown) => {
    logError("bridge", error);
  },
);
