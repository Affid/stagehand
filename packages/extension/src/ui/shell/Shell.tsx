// The new Setup page: header, worlds rail, and a world's page or the Library.
import { useEffect } from "preact/hooks";
import { useUi } from "../context.ts";
import { LibraryPage } from "./library/LibraryPage.tsx";
import { ModulePanel } from "./library/ModulePanel.tsx";
import { IntakePanel } from "./library/panels/IntakePanel.tsx";
import { PresetsPanel } from "./library/panels/PresetsPanel.tsx";
import { SystemPanel } from "./library/panels/SystemPanel.tsx";
import { TagsPanel } from "./library/panels/TagsPanel.tsx";
import { ServerBackupsPage } from "./server/backups/BackupsPage.tsx";
import { ConfigPage } from "./server/ConfigPage.tsx";
import { UpdatePage } from "./server/UpdatePage.tsx";
import { Header } from "./Header.tsx";
import { resolveRoute } from "./route.ts";
import { WorldPage } from "./WorldPage.tsx";
import { useScheduleSync } from "./world/about/session/useScheduleSync.ts";
import { WorldRail } from "./WorldRail.tsx";

/** The Library's own panels: Tags, Presets, New modules. */
function SideColumn() {
  const { state, store } = useUi();
  const side = state.side;
  const gone =
    side?.kind === "system" &&
    !state.data.setup?.systems.some((s) => s.id === side.id);
  // Its system was uninstalled: close, as a module's panel does (review).
  useEffect(() => {
    if (gone) store.set({ side: null });
  }, [gone, store]);
  if (side?.kind === "tags") return <TagsPanel id={side.id} />;
  if (side?.kind === "presets") return <PresetsPanel id={side.id} />;
  if (side?.kind === "intake") return <IntakePanel />;
  if (side?.kind === "system")
    return <SystemPanel key={side.id} id={side.id} />;
  return null;
}

/** The module details column, beside the Library or a world's page. */
function PanelColumn(props: { readonly here: string | undefined }) {
  const { state } = useUi();
  // The Library's panels show only on the Library (no world here).
  if (!props.here && state.side && !state.panel) return <SideColumn />;
  return <ModuleColumn here={props.here} />;
}

function ModuleColumn(props: { readonly here: string | undefined }) {
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

/** Once per Setup load: which packages Foundry would update (behind its flag). */
function useUpdateCheck(): void {
  const { state, page } = useUi();
  const a = state.adapter;
  const on = a.status !== "safe-mode" && a.adapter.flags.updateCheck === true;
  useEffect(() => {
    if (on) page.checkUpdates();
  }, [on, page]);
}

export function Shell() {
  const { state } = useUi();
  useScheduleSync();
  useUpdateCheck();
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
