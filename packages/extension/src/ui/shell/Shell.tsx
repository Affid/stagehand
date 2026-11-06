// The new Setup page: header, worlds rail, and a world's page or the Library.
import { useEffect } from "preact/hooks";
import { useUi } from "../context.ts";
import { LibraryPage } from "./library/LibraryPage.tsx";
import { ModulePanel } from "./library/ModulePanel.tsx";
import { ServerBackupsPage } from "./server/backups/BackupsPage.tsx";
import { ConfigPage } from "./server/ConfigPage.tsx";
import { UpdatePage } from "./server/UpdatePage.tsx";
import { Header } from "./Header.tsx";
import { resolveRoute } from "./route.ts";
import { WorldPage } from "./WorldPage.tsx";
import { useScheduleSync } from "./world/about/session/useScheduleSync.ts";
import { WorldRail } from "./WorldRail.tsx";

/** The module details column, beside the Library or a world's page. */
function PanelColumn(props: { readonly here: string | undefined }) {
  const { state, store } = useUi();
  const pkg = state.panel
    ? state.data.setup?.modules.find((m) => m.id === state.panel)
    : undefined;
  // Its module was uninstalled: close, so it doesn't reopen on a reinstall.
  useEffect(() => {
    if (state.panel && !pkg) store.set({ panel: null });
  }, [state.panel, pkg, store]);
  if (!pkg) return null;
  return (
    <ModulePanel
      key={pkg.id}
      pkg={pkg}
      here={props.here}
      onClose={() => store.set({ panel: null })}
    />
  );
}

export function Shell() {
  const { state } = useUi();
  useScheduleSync();
  const worlds = state.data.setup?.worlds ?? [];
  const route = resolveRoute(state.route, worlds, state.data.setup?.lang);
  const world =
    route.kind === "world"
      ? worlds.find((w) => w.id === route.worldId)
      : undefined;
  return (
    <div class="mls-shell">
      <Header />
      <div class="mls">
        <WorldRail route={route} />
        {route.kind === "server" ? (
          <section class="application framed mls-main">
            <div class="mls-body-main">
              {route.page === "config" ? (
                <ConfigPage />
              ) : route.page === "update" ? (
                <UpdatePage />
              ) : (
                <ServerBackupsPage />
              )}
            </div>
          </section>
        ) : world ? (
          <WorldPage key={world.id} world={world} />
        ) : (
          <section class="application framed mls-main mls-library">
            <div class="mls-body-main">
              <LibraryPage />
            </div>
          </section>
        )}
        {route.kind === "server" ? null : <PanelColumn here={world?.id} />}
      </div>
    </div>
  );
}
