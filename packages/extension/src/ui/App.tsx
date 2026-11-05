// The three roots the Setup UI mounts: modules tab, worlds tab, and the
// overlay, whose windows open in Foundry's own window frames.
import type { ComponentChildren } from "preact";
import { UiContext, type UiDeps, useUi } from "./context.ts";
import { ModulesView } from "./modules/ModulesView.tsx";
import { PresetEditor } from "./presets/PresetEditor.tsx";
import { ApplyDialog } from "./worlds/ApplyDialog.tsx";
import { WorldSheet } from "./worlds/WorldSheet.tsx";
import { WorldsPanel } from "./worlds/WorldsPanel.tsx";

const Provider = (props: {
  readonly deps: UiDeps;
  readonly children: ComponentChildren;
}) => (
  <UiContext.Provider value={props.deps}>{props.children}</UiContext.Provider>
);

function Overlay() {
  const { state } = useUi();
  return (
    <>
      {state.editingPreset !== null ? (
        <PresetEditor
          key={`${state.editingPreset}:${state.draftModules.join(",")}`}
        />
      ) : null}
      {state.sheetWorld !== null ? (
        <WorldSheet key={state.sheetWorld} worldId={state.sheetWorld} />
      ) : null}
      {state.apply !== null ? (
        <ApplyDialog
          key={state.apply.worldId ?? ""}
          worldId={state.apply.worldId}
        />
      ) : null}
    </>
  );
}

export const ModulesRoot = (props: { readonly deps: UiDeps }) => (
  <Provider deps={props.deps}>
    <ModulesView />
  </Provider>
);

export const WorldsRoot = (props: { readonly deps: UiDeps }) => (
  <Provider deps={props.deps}>
    <WorldsPanel />
  </Provider>
);

export const OverlayRoot = (props: { readonly deps: UiDeps }) => (
  <Provider deps={props.deps}>
    <Overlay />
  </Provider>
);
