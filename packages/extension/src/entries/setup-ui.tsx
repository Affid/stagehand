// Isolated content script on Setup: receives package data from the main
// world, reports it to the background and mounts the organisation UI, or
// the new Setup page when this browser chose it.
// Never breaks the Setup page: if a mount point is missing, it skips it.
import "@module-library/shared/zod-config";
import { logError } from "@module-library/shared/log";
import { isEnvelope } from "@module-library/shared/protocol";
import { parseCoreVersion } from "@module-library/shared/version";
import { type SetupData, SetupDataSchema } from "@module-library/shared/world";
import { type ComponentType, render } from "preact";
import { type Adapter, V14_SELECTORS } from "../adapters/config.ts";
import {
  type AdapterChoice,
  allowsChanges,
  selectAdapter,
} from "../adapters/select.ts";
import type { SetupState } from "../messages.ts";
import { send } from "../platform/runtime.ts";
import { createActions } from "../ui/actions.ts";
import { ModulesRoot, OverlayRoot, WorldsRoot } from "../ui/App.tsx";
import type { UiDeps } from "../ui/context.ts";
import { createTranslator, pickLanguage } from "../ui/i18n.ts";
import { worldRows } from "../ui/model/worlds.ts";
import { createPageBridge, type PageBridge } from "../ui/page.ts";
import { syncShell } from "../ui/shell/mount.tsx";
import { createStore, EMPTY_FILTER, type Store } from "../ui/store.ts";
import { syncWorldTags } from "../ui/worlds/tags.ts";

const ROOTS = {
  modules: "ml-modules-root",
  worlds: "ml-worlds-root",
  overlay: "ml-overlay-root",
} as const;

let deps: UiDeps | undefined;
let selectors: Adapter["selectors"] = V14_SELECTORS;
const page = createPageBridge(window);

/** Safe mode still reads and shows; it borrows the newest known selectors. */
function selectorsFor(choice: AdapterChoice): Adapter["selectors"] {
  return choice.status === "safe-mode" ? selectors : choice.adapter.selectors;
}

function syncCoreList(): void {
  const list = document.querySelector<HTMLElement>(selectors.modulesList);
  // Only ever hide core's list inside the Setup app, never our own roots.
  const safe =
    list?.closest("#setup-packages") && !list.querySelector("[id^='ml-']");
  if (list && safe && deps) list.hidden = deps.store.get().view === "organised";
}

let tagged: { data: unknown; selectors: unknown; cards: number } | undefined;

/** Our tag on Foundry's world cards; Foundry re-renders wipe it. */
function syncTags(): void {
  if (!deps) return;
  const { store, t } = deps;
  const { data } = store.get();
  const cards = document.querySelectorAll(selectors.worldCard).length;
  const tags = document.querySelectorAll(".ml-world-tag").length;
  // Filter keystrokes and selections change the store but not the tags.
  const same =
    tagged?.data === data &&
    tagged.selectors === selectors &&
    tagged.cards === cards &&
    tags === cards;
  if (same) return;
  tagged = { data, selectors, cards };
  syncWorldTags(document, selectors, worldRows(data), t, (id) => {
    store.set({ sheetWorld: id });
  });
}

/** Our entries in Foundry's right-click menu on world cards. */
function syncMenu(store: Store, t: UiDeps["t"]): () => void {
  let last = "";
  return () => {
    const s = store.get();
    const canChange = s.data.adminVerified && allowsChanges(s.adapter);
    const labels = {
      details: t("menu.details"),
      ...(canChange ? { apply: t("menu.apply") } : {}),
    };
    const key = JSON.stringify([labels, s.selectors.worldCard]);
    if (key === last) return;
    last = key;
    page.setMenu(labels, s.selectors.worldCard);
  };
}

function listenToPage(store: Store, bridge: PageBridge): void {
  bridge.subscribe((e) => {
    if (e.type !== "MENU_ACTION") return;
    const { action, worldId } = e.payload;
    // The page can post anything: only act for worlds Setup listed.
    const known = store.get().data.setup?.worlds.some((w) => w.id === worldId);
    if (!known) return;
    store.set(
      action === "apply" ? { apply: { worldId } } : { sheetWorld: worldId },
    );
  });
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
    deps.store.set({ data: state, adapter, selectors });
    return deps;
  }
  const t = createTranslator(pickLanguage(data.lang, navigator.language));
  const store = createStore({
    data: state,
    adapter,
    selectors,
    view: "organised",
    scope: { kind: "all" },
    filter: EMPTY_FILTER,
    selection: [],
    editingPreset: null,
    draftModules: [],
    apply: null,
    sheetWorld: null,
    collapsedGroups: [],
    route: null,
  });
  store.subscribe(syncCoreList);
  store.subscribe(syncTags);
  const menu = syncMenu(store, t);
  store.subscribe(menu);
  menu();
  listenToPage(store, page);
  deps = { store, actions: createActions(store, send, t, page), t, page };
  // The new Setup page, when this browser chose it (build plan, Phase 1).
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
  mountBefore(selectors.modulesList, ROOTS.modules, ModulesRoot);
  mountBefore(selectors.worldsList, ROOTS.worlds, WorldsRoot);
  mountOverlay();
  syncCoreList();
  syncTags();
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
