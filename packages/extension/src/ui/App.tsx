// The roots the Setup UI mounts: modules tab, worlds tab, the overlay,
// whose windows open in Foundry's own window frames, and the new Setup page.
import type { ComponentChildren } from "preact";
import { useErrorBoundary } from "preact/hooks";
import { UiContext, type UiDeps, useUi } from "./context.ts";
import { ModulesView } from "./modules/ModulesView.tsx";
import { PresetEditor } from "./presets/PresetEditor.tsx";
import { Shell } from "./shell/Shell.tsx";
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

/** Renders nothing after an error and reports it, so Foundry's page can return. */
function Guard(props: {
  readonly onError: (error: unknown) => void;
  readonly children: ComponentChildren;
}) {
  const caught: unknown = useErrorBoundary(props.onError)[0];
  return caught ? null : <>{props.children}</>;
}

export const ShellRoot = (props: {
  readonly deps: UiDeps;
  readonly onError?: (error: unknown) => void;
}) => (
  <Provider deps={props.deps}>
    <Guard onError={props.onError ?? (() => undefined)}>
      <Shell />
    </Guard>
  </Provider>
);
