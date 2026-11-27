// Setup's side of the shared modules view (@stagehand/ui): its state,
// actions and permissions as that view's context. Setup sees every world
// and organises the library; Foundry's own package actions are its own.
import type { ComponentChildren } from "preact";
import { type ModulesUi, ModulesContext } from "@stagehand/ui/context.ts";
import { useUi } from "./context.ts";
import { OnServer } from "./shell/library/OnServer.tsx";
import { hasUpdatesTab } from "./shell/library/head/LibraryTabs.tsx";
import { UpdateBox } from "./shell/library/updates/UpdateBox.tsx";

export function SetupModules(props: { readonly children: ComponentChildren }) {
  const { state, store, actions, t, canChange } = useUi();
  const ui: ModulesUi = {
    t,
    data: state.data,
    where: "setup",
    canSwitch: canChange,
    canOrganise: canChange,
    view: state.worldView,
    panel: state.panel,
    openPanel: (id) => {
      store.set({ panel: id, side: null });
    },
    flip: (worldId, moduleId, on) => actions.flip(worldId, moduleId, on),
    queueApply: (worldId, mode, presetIds, modules) =>
      actions.queueApply(worldId, mode, presetIds, modules),
    organise: (op) => actions.op(op),
    PackageActions: OnServer,
    ...(hasUpdatesTab(state) ? { PackageUpdate: UpdateBox } : {}),
  };
  return (
    <ModulesContext.Provider value={ui}>
      {props.children}
    </ModulesContext.Provider>
  );
}
