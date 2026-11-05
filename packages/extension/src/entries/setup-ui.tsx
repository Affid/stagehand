// Isolated content script on Setup: receives package data from the main
// world, reports it to the background and mounts the organisation UI.
// Never breaks the Setup page: if a mount point is missing, it skips it.
import { logError } from "@module-library/shared/log";
import { isEnvelope } from "@module-library/shared/protocol";
import { parseCoreVersion } from "@module-library/shared/version";
import { type SetupData, SetupDataSchema } from "@module-library/shared/world";
import { type ComponentType, render } from "preact";
import { type Adapter, V14_SELECTORS } from "../adapters/config.ts";
import { type AdapterChoice, selectAdapter } from "../adapters/select.ts";
import type { SetupState } from "../messages.ts";
import { send } from "../platform/runtime.ts";
import { createActions } from "../ui/actions.ts";
import { ModulesRoot, OverlayRoot, WorldsRoot } from "../ui/App.tsx";
import type { UiDeps } from "../ui/context.ts";
import { createTranslator, pickLanguage } from "../ui/i18n.ts";
import { createStore, EMPTY_FILTER } from "../ui/store.ts";

const ROOTS = {
  modules: "ml-modules-root",
  worlds: "ml-worlds-root",
  overlay: "ml-overlay-root",
} as const;

let deps: UiDeps | undefined;
let selectors: Adapter["selectors"] = V14_SELECTORS;

/** Safe mode still reads and shows; it borrows the newest known selectors. */
function selectorsFor(choice: AdapterChoice): Adapter["selectors"] {
  return choice.status === "safe-mode" ? selectors : choice.adapter.selectors;
}

function syncCoreList(): void {
  const list = document.querySelector<HTMLElement>(selectors.modulesList);
  if (list && deps) list.hidden = deps.store.get().view === "organised";
}

function mountBefore(
  anchorSelector: string,
  id: string,
  Root: ComponentType<{ deps: UiDeps }>,
): void {
  const anchor = document.querySelector(anchorSelector);
  if (!anchor?.parentElement || !deps) return;
  const stale = document.getElementById(id);
  if (stale?.nextElementSibling === anchor) return;
  if (stale) render(null, stale);
  stale?.remove();
  const container = document.createElement("div");
  container.id = id;
  anchor.parentElement.insertBefore(container, anchor);
  render(<Root deps={deps} />, container);
}

function mountOverlay(): void {
  if (!deps || document.getElementById(ROOTS.overlay)) return;
  const container = document.createElement("div");
  container.id = ROOTS.overlay;
  document.body.append(container);
  render(<OverlayRoot deps={deps} />, container);
}

function ensureDeps(
  data: SetupData,
  state: SetupState,
  adapter: AdapterChoice,
): UiDeps {
  if (deps) {
    deps.store.set({ data: state, adapter });
    return deps;
  }
  const t = createTranslator(pickLanguage(data.lang, navigator.language));
  const store = createStore({
    data: state,
    adapter,
    view: "organised",
    scope: { kind: "all" },
    filter: EMPTY_FILTER,
    selection: [],
    editingPreset: null,
    draftModules: [],
    applyWorld: null,
    notice: null,
  });
  store.subscribe(syncCoreList);
  deps = { store, actions: createActions(store, send, t), t };
  return deps;
}

async function onSetupData(data: SetupData): Promise<void> {
  const state = await send<SetupState>({ kind: "setup-seen", data });
  const adapter = selectAdapter(
    state.config,
    parseCoreVersion(data.core.version),
  );
  ensureDeps(data, state, adapter);
  selectors = selectorsFor(adapter);
  mountBefore(selectors.modulesList, ROOTS.modules, ModulesRoot);
  mountBefore(selectors.worldsList, ROOTS.worlds, WorldsRoot);
  mountOverlay();
  syncCoreList();
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
