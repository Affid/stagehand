// The root the Setup UI mounts: the new Setup page.
import type { ComponentChildren } from "preact";
import { useErrorBoundary } from "preact/hooks";
import { UiContext, type UiDeps } from "./context.ts";
import { Shell } from "./shell/Shell.tsx";

const Provider = (props: {
  readonly deps: UiDeps;
  readonly children: ComponentChildren;
}) => (
  <UiContext.Provider value={props.deps}>{props.children}</UiContext.Provider>
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
