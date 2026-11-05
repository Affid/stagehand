// The three roots the Setup UI mounts: modules tab, worlds tab, overlay.
import type { ComponentChildren } from "preact";
import { UiContext, type UiDeps, useUi } from "./context.ts";
import { ModulesView } from "./modules/ModulesView.tsx";
import { PresetEditor } from "./presets/PresetEditor.tsx";
import { ApplyDialog } from "./worlds/ApplyDialog.tsx";
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
        <PresetEditor key={state.editingPreset} />
      ) : null}
      {state.applyWorld !== null ? (
        <ApplyDialog key={state.applyWorld} worldId={state.applyWorld} />
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
