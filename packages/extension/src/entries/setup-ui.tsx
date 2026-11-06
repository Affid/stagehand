// Isolated content script on Setup: receives package data from the main
// world, reports it to the background and mounts the new Setup page over
// Foundry's. Never breaks Setup: if the page can't start, Foundry's stays.
import "@module-library/shared/zod-config";
import { logError } from "@module-library/shared/log";
import { isEnvelope } from "@module-library/shared/protocol";
import { parseCoreVersion } from "@module-library/shared/version";
import { type SetupData, SetupDataSchema } from "@module-library/shared/world";
import { render } from "preact";
import { type Adapter, V14_SELECTORS } from "../adapters/config.ts";
import { type AdapterChoice, selectAdapter } from "../adapters/select.ts";
import type { SetupState } from "../messages.ts";
import { send } from "../platform/runtime.ts";
import { createActions } from "../ui/actions.ts";
import { OverlayRoot } from "../ui/App.tsx";
import type { UiDeps } from "../ui/context.ts";
import { createTranslator, pickLanguage } from "../ui/i18n.ts";
import { createPageBridge } from "../ui/page.ts";
import { syncShell } from "../ui/shell/mount.tsx";
import { createStore, EMPTY_FILTER } from "../ui/store.ts";

const OVERLAY_ROOT = "ml-overlay-root";

let deps: UiDeps | undefined;
let selectors: Adapter["selectors"] = V14_SELECTORS;
const page = createPageBridge(window);

/** Safe mode still reads and shows; it borrows the newest known selectors. */
function selectorsFor(choice: AdapterChoice): Adapter["selectors"] {
  return choice.status === "safe-mode" ? selectors : choice.adapter.selectors;
}

/** Foundry windows our page opens (preset editor) render in this root. */
function mountOverlay(): void {
  if (!deps || document.getElementById(OVERLAY_ROOT)) return;
  const container = document.createElement("div");
  container.id = OVERLAY_ROOT;
  document.body.append(container);
  render(<OverlayRoot deps={deps} />, container);
}

function ensureDeps(
  data: SetupData,
  state: SetupState,
  adapter: AdapterChoice,
): UiDeps {
  if (deps) {
    deps.store.set({ data: state, adapter, selectors });
    return deps;
  }
  const t = createTranslator(pickLanguage(data.lang, navigator.language));
  const store = createStore({
    data: state,
    adapter,
    selectors,
    scope: { kind: "all" },
    filter: EMPTY_FILTER,
    selection: [],
    editingPreset: null,
    draftModules: [],
    collapsedGroups: [],
    route: null,
  });
  deps = { store, actions: createActions(store, send, t, page), t, page };
  // The new Setup page takes over whenever the extension runs (not in safe mode).
  const shell = syncShell(deps, document);
  store.subscribe(shell);
  shell();
  return deps;
}

async function onSetupData(data: SetupData): Promise<void> {
  const state = await send<SetupState>({ kind: "setup-seen", data });
  const adapter = selectAdapter(
    state.config,
    parseCoreVersion(data.core.version),
  );
  selectors = selectorsFor(adapter);
  ensureDeps(data, state, adapter);
  mountOverlay();
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (!isEnvelope(event.data, "setup-main") || event.data.type !== "SETUP_DATA")
    return;
  const parsed = SetupDataSchema.safeParse(event.data.payload);
  if (!parsed.success) {
    logError("setup data", parsed.error);
    return;
  }
  onSetupData(parsed.data).catch((error: unknown) => {
    logError("setup", error);
  });
});
