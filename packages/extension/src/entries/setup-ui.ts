// Isolated content script on Setup: receives package data from the main
// world, reports it to the background and mounts the organisation UI.
// Interim (M1 phase 2): a status line; the full UI comes in phase 3.
import { logError } from "@module-library/shared/log";
import { isEnvelope } from "@module-library/shared/protocol";
import { SetupDataSchema } from "@module-library/shared/world";
import type { SetupState } from "../messages.ts";
import { send } from "../runtime.ts";

const PANEL_ID = "module-library-panel";

function mount(state: SetupState): void {
  document.getElementById(PANEL_ID)?.remove();
  const host = document.getElementById("setup-packages-worlds");
  if (!host || !state.setup) return;
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = `Module Library: ${String(state.setup.modules.length)} modules, ${String(state.setup.worlds.length)} worlds, core ${state.setup.core.version}, ${state.adminVerified ? "admin verified" : "not verified"}`;
  panel.append(summary);
  host.prepend(panel);
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (!isEnvelope(event.data, "setup-main")) return;
  if (event.data.type !== "SETUP_DATA") return;
  const parsed = SetupDataSchema.safeParse(event.data.payload);
  if (!parsed.success) {
    logError("setup data", parsed.error);
    return;
  }
  send<SetupState>({ kind: "setup-seen", data: parsed.data }).then(
    mount,
    (error: unknown) => {
      logError("setup", error);
    },
  );
});
