// The view's chunk, loaded when a Gamemaster opens Module Management: the
// window's store (kept while the window is open, so Foundry's redraws keep
// the unsaved changes), the dialogs, and saving as Foundry does: core's
// module configuration, then everyone reloads.
import { logError } from "@stagehand/shared/log";
import type { Library } from "@stagehand/shared/library/schema";
import type { ModulesData } from "@stagehand/ui/model/data.ts";
import { render } from "preact";
import type { DialogV2, FoundryGame } from "../foundry.ts";
import { escapeHtml } from "../dialog.ts";
import { moduleConfiguration } from "../world-state.ts";
import { WorldView } from "./App.tsx";
import { addChange, type Fresh } from "./changes.ts";
import { pickPreset } from "./pick-preset.ts";
import { reviewChanges } from "./review.ts";
import { createViewStore, type Prefs, type ViewStore } from "./store.ts";
import { worldTranslator } from "./translate.ts";
import { worldData } from "./world-data.ts";

export interface MountDeps {
  /** Foundry's window: its store lives as long as it does. */
  readonly app: object;
  readonly game: FoundryGame;
  readonly library: Library;
  readonly dialog: DialogV2;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
  readonly reloadAll: () => void;
  readonly prefs: Prefs;
  readonly canSwitch: boolean;
  readonly fullGM: boolean;
  /** Gives the guard the review that Foundry's save opens. */
  readonly setReview: (review: () => void) => void;
}

const stores = new WeakMap<object, ViewStore>();

function storeFor(deps: MountDeps): ViewStore {
  const known = stores.get(deps.app);
  if (known) return known;
  const store = createViewStore(deps.prefs);
  stores.set(deps.app, store);
  return store;
}

/** Unique for the page, across windows and redraws. */
let made = 0;
const fresh = (): Fresh => ({
  id: `local-${String(++made)}`,
  createdAt: new Date().toISOString(),
});

const message = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/** Runs `open` unless its dialog is already open (a double click on Save). */
function once<T>(open: (data: T) => Promise<unknown>): (data: T) => void {
  let busy = false;
  return (data) => {
    if (busy) return;
    busy = true;
    void open(data).finally(() => {
      busy = false;
    });
  };
}

function reviewer(deps: MountDeps): (data: ModulesData) => void {
  const { game } = deps;
  const save = async (target: readonly string[]): Promise<void> => {
    const config = moduleConfiguration(game, target);
    await game.settings.set("core", "moduleConfiguration", config);
    deps.reloadAll();
  };
  const review = { dialog: deps.dialog, game, warn: deps.warn, save };
  return once((data: ModulesData) =>
    reviewChanges(review, data).catch((e: unknown) => {
      logError("module view", e);
      deps.error(
        game.i18n.format("STAGEHAND.Manage.SaveFailed", {
          error: escapeHtml(message(e)),
        }),
      );
    }),
  );
}

function picker(
  deps: MountDeps,
  store: ViewStore,
): (data: ModulesData) => void {
  const worldId = deps.game.world.id;
  const onPick: Parameters<typeof pickPreset>[0]["onPick"] = (
    mode,
    presetIds,
  ) => {
    const change = { mode, presetIds };
    store.set({
      changes: addChange(store.get().changes, worldId, change, fresh()),
    });
  };
  const pick = {
    dialog: deps.dialog,
    game: deps.game,
    warn: deps.warn,
    onPick,
  };
  return once((data: ModulesData) =>
    pickPreset(pick, data).catch((e: unknown) => {
      logError("module view", e);
    }),
  );
}

export function mountView(
  host: HTMLElement,
  deps: MountDeps,
): { readonly unmount: () => void } {
  const store = storeFor(deps);
  const now = new Date().toISOString();
  const review = reviewer(deps);
  const base = worldData(deps.game, deps.library, [], now);
  deps.setReview(() => {
    review({ ...base, commands: store.get().changes });
  });
  const viewDeps = {
    game: deps.game,
    library: deps.library,
    store,
    canSwitch: deps.canSwitch,
    canApplyPresets: deps.fullGM,
    t: worldTranslator(deps.game.i18n.lang),
    foundryText: (key: string) => deps.game.i18n.localize(key),
    review,
    pickPreset: picker(deps, store),
    fresh,
    now,
  };
  render(<WorldView deps={viewDeps} />, host);
  return {
    unmount: () => {
      render(null, host);
    },
  };
}
