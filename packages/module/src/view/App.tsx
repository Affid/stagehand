// Stagehand's view in Module Management (design/in-world-library): Setup's
// world page cards and module panel for this world, with changes marked
// until the review saves them, the mockup's tools row, and Foundry's form
// kept equal to the cards (FailSafe).
import type { Library } from "@stagehand/shared/library/schema";
import { COMPANION_ID } from "@stagehand/shared/companion";
import { ModulesContext, type ModulesUi } from "@stagehand/ui/context.ts";
import type { Translate } from "@stagehand/ui/i18n.ts";
import type { ModulesData } from "@stagehand/ui/model/data.ts";
import {
  type WorldModules,
  worldModules,
} from "@stagehand/ui/model/world-modules.ts";
import { ModulePanel } from "@stagehand/ui/panel/ModulePanel.tsx";
import { type Filters, ModulesTab } from "@stagehand/ui/world/ModulesTab.tsx";
import { useMemo } from "preact/hooks";
import type { FoundryGame } from "../foundry.ts";
import { addChange, flipChange, type Fresh } from "./changes.ts";
import { FailSafe } from "./FailSafe.tsx";
import { Footer, Pending } from "./Footer.tsx";
import { useViewState, type ViewState, type ViewStore } from "./store.ts";
import { Tools } from "./Tools.tsx";
import { type WorldData, worldData } from "./world-data.ts";

export interface ViewDeps {
  readonly game: FoundryGame;
  readonly library: Library;
  readonly store: ViewStore;
  /** Foundry lets this user change modules ("Modify settings"). */
  readonly canSwitch: boolean;
  /** Full Gamemasters (the mockup's roles). */
  readonly canApplyPresets: boolean;
  readonly t: Translate;
  /** Foundry's own words, for its own buttons. */
  readonly foundryText: (key: string) => string;
  readonly review: (data: ModulesData) => void;
  readonly pickPreset: (data: ModulesData) => void;
  readonly fresh: () => Fresh;
  readonly now: string;
}

function contextFor(
  deps: ViewDeps,
  base: ModulesData,
  s: ViewState,
): ModulesUi {
  const { store } = deps;
  const current = (): ModulesData => ({
    ...base,
    commands: store.get().changes,
  });
  return {
    t: deps.t,
    data: { ...base, commands: s.changes },
    where: "world",
    canSwitch: deps.canSwitch,
    canOrganise: false,
    view: { by: s.by, layout: "cards" },
    panel: s.panel,
    openPanel: (id) => {
      store.set({ panel: id });
    },
    folded: s.folded,
    onFold: (key) => {
      store.toggleFold(key);
    },
    flip: (worldId, moduleId, on) => {
      store.set({
        changes: flipChange(current(), worldId, moduleId, on, deps.fresh()),
      });
      return Promise.resolve();
    },
    queueApply: (worldId, mode, presetIds, modules) => {
      const change = { mode, presetIds, modules };
      store.set({
        changes: addChange(store.get().changes, worldId, change, deps.fresh()),
      });
      return Promise.resolve();
    },
    organise: () => Promise.resolve(),
  };
}

const filtersOf = (store: ViewStore, s: ViewState): Filters => ({
  show: s.show,
  text: s.text,
  onShow: (show) => {
    store.set({ show });
  },
  onText: (text) => {
    store.set({ text });
  },
});

interface PartProps {
  readonly deps: ViewDeps;
  readonly s: ViewState;
  readonly base: WorldData;
  readonly ui: ModulesUi;
  readonly model: WorldModules;
}

function Head(props: PartProps) {
  const { deps, s, ui, model } = props;
  const { store } = deps;
  return (
    <>
      <Tools
        model={model}
        filters={filtersOf(store, s)}
        by={s.by}
        onBy={(by) => {
          store.set({ by });
        }}
        onApplyPreset={
          deps.canApplyPresets ? () => deps.pickPreset(ui.data) : undefined
        }
      />
      <Pending
        model={model}
        onReview={() => deps.review(ui.data)}
        onDiscard={() => {
          store.set({ changes: [] });
        }}
      />
    </>
  );
}

function Body(props: PartProps) {
  const { deps, s, base, model } = props;
  const panelPkg = base.setup.modules.find((m) => m.id === s.panel);
  return (
    <div class="stagehand-body">
      <ModulesTab
        world={base.world}
        model={model}
        filters={filtersOf(deps.store, s)}
      />
      {panelPkg ? (
        <ModulePanel
          pkg={panelPkg}
          here={base.world.id}
          onClose={() => {
            deps.store.set({ panel: null });
          }}
        />
      ) : null}
    </div>
  );
}

function Foot(props: PartProps) {
  const { deps, base, ui, model } = props;
  const turnOff = model.rows
    .filter((r) => r.next && r.pkg.id !== COMPANION_ID)
    .map((r) => r.pkg.id);
  return (
    <>
      {deps.canSwitch ? (
        <Footer
          changes={model.changes}
          foundryText={deps.foundryText}
          onSave={() => deps.review(ui.data)}
          onDeactivateAll={() => {
            if (turnOff.length)
              void ui.queueApply(base.world.id, "remove", [], turnOff);
          }}
        />
      ) : null}
      <FailSafe
        installed={base.setup.modules.map((m) => m.id)}
        on={new Set(model.next)}
      />
    </>
  );
}

export function WorldView(props: { readonly deps: ViewDeps }) {
  const { deps } = props;
  const s = useViewState(deps.store);
  const base = useMemo(
    () => worldData(deps.game, deps.library, [], deps.now),
    [deps.game, deps.library, deps.now],
  );
  const ui = contextFor(deps, base, s);
  const model = worldModules(ui.data, base.world.id);
  const parts: PartProps = { deps, s, base, ui, model };
  return (
    <ModulesContext.Provider value={ui}>
      <div class="st-app st-ui stagehand-view">
        <Head {...parts} />
        <Body {...parts} />
        <Foot {...parts} />
      </div>
    </ModulesContext.Provider>
  );
}
