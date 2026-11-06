// The roots the Setup UI mounts: the new Setup page, and the overlay, whose
// windows open in Foundry's own window frames.
import type { ComponentChildren } from "preact";
import { useErrorBoundary } from "preact/hooks";
import { UiContext, type UiDeps, useUi } from "./context.ts";
import { PresetEditor } from "./presets/PresetEditor.tsx";
import { Shell } from "./shell/Shell.tsx";

const Provider = (props: {
  readonly deps: UiDeps;
  readonly children: ComponentChildren;
}) => (
  <UiContext.Provider value={props.deps}>{props.children}</UiContext.Provider>
);

/** Foundry windows our page opens: the preset editor. */
function Overlay() {
  const { state } = useUi();
  return state.editingPreset !== null ? (
    <PresetEditor
      key={`${state.editingPreset}:${state.draftModules.join(",")}`}
    />
  ) : null;
}

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
