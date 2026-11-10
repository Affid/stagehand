// Our half of the Setup page: hears Setup's data from Foundry's half,
// reports it to the background and mounts the new Setup page over
// Foundry's. Never breaks Setup: if the page can't start, Foundry's stays.
// Started by the extension's setup-ui script and by the app's app-setup
// script, each with its own channel, background and ports.
import { logError } from "@stagehand/shared/log";
import { parseCoreVersion } from "@stagehand/shared/version";
import { type SetupData, SetupDataSchema } from "@stagehand/shared/world";
import { type Adapter, V14_SELECTORS } from "../adapters/config.ts";
import { type AdapterChoice, selectAdapter } from "../adapters/select.ts";
import type { SetupState } from "../messages.ts";
import type { PageChannel } from "../page-channel.ts";
import { NO_UPDATES } from "../page-updates.ts";
import { createActions, type Send } from "./actions.ts";
import type { UiDeps } from "./context.ts";
import { createTranslator, pickLanguage } from "./i18n.ts";
import { liftVeil } from "../page/veil.ts";
import { createPageBridge } from "./page.ts";
import type { UiPorts } from "./ports.ts";
import { syncShell } from "./shell/mount.tsx";
import { createStore, DEFAULT_WORLD_VIEW, EMPTY_FILTER } from "./store.ts";
import { trackProgress, UNLOCKED } from "./tasks.ts";
import { START_NAV } from "./shell/phone/nav.ts";

export interface SetupUiDeps {
  readonly channel: PageChannel;
  /** A message to the background, unwrapped. */
  readonly send: Send;
  readonly ports: UiPorts;
  readonly doc: Document;
}

/** Safe mode still reads and shows; it borrows the newest known selectors. */
function selectorsFor(
  choice: AdapterChoice,
  newest: Adapter["selectors"],
): Adapter["selectors"] {
  return choice.status === "safe-mode" ? newest : choice.adapter.selectors;
}

interface SetupUiState {
  readonly data: SetupState;
  readonly adapter: AdapterChoice;
  readonly selectors: Adapter["selectors"];
}

function createUi(
  deps: SetupUiDeps,
  page: UiDeps["page"],
  data: SetupData,
  initial: SetupUiState,
): UiDeps {
  const t = createTranslator(pickLanguage(data.lang, navigator.language));
  const store = createStore({
    ...initial,
    scope: { kind: "all" },
    filter: EMPTY_FILTER,
    selection: [],
    collapsedGroups: [],
    route: null,
    phone: START_NAV,
    nextLaunch: null,
    panel: null,
    side: null,
    worldView: DEFAULT_WORLD_VIEW,
    tasks: [],
    lock: UNLOCKED,
    updates: NO_UPDATES,
    launching: null,
  });
  trackProgress(store, page);
  const actions = createActions(store, deps.send, t, page);
  return { store, actions, t, page, ports: deps.ports };
}

/** Listens for Setup's data on `channel` and runs the new Setup page. */
export function startSetupUi(deps: SetupUiDeps): void {
  const page = createPageBridge(deps.channel);
  let ui: UiDeps | undefined;
  let selectors: Adapter["selectors"] = V14_SELECTORS;

  const onSetupData = async (data: SetupData): Promise<void> => {
    const state = await deps.send<SetupState>({ kind: "setup-seen", data });
    const adapter = selectAdapter(
      state.config,
      parseCoreVersion(data.core.version),
    );
    selectors = selectorsFor(adapter, selectors);
    const next = { data: state, adapter, selectors };
    if (ui) {
      ui.store.set(next);
      return;
    }
    ui = createUi(deps, page, data, next);
    // The new Setup page takes over whenever we run (not in safe mode).
    const shell = syncShell(ui, deps.doc);
    ui.store.subscribe(shell);
    shell();
  };

  deps.channel.listen((type, payload) => {
    if (type !== "SETUP_DATA") return;
    const parsed = SetupDataSchema.safeParse(payload);
    if (!parsed.success) {
      logError("setup data", parsed.error);
      if (!ui) liftVeil(deps.doc);
      return;
    }
    onSetupData(parsed.data).catch((error: unknown) => {
      logError("setup", error);
      // Not started: Foundry's page comes back now, not after the veil's
      // timeout (the background refused, or isn't there).
      if (!ui) liftVeil(deps.doc);
    });
  });
}
