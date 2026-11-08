// The new Setup page: header, worlds rail, and a world's page or the Library;
// in the phone and tablet layouts (phone/PhoneShell.tsx) the same pages one at
// a time under a tab bar.
import { useEffect } from "preact/hooks";
import { useUi } from "../context.ts";
import { Announcer } from "./Announcer.tsx";
import { Header } from "./Header.tsx";
import { MainPane, PanelColumn, useShownRoute } from "./Panes.tsx";
import { LayoutContext, useViewportLayout } from "./phone/layout.ts";
import { PhoneShell } from "./phone/PhoneShell.tsx";
import { useScheduleSync } from "./world/about/session/useScheduleSync.ts";
import { WorldRail } from "./WorldRail.tsx";

/** Once per Setup load: which packages Foundry would update (behind its flag). */
function useUpdateCheck(): void {
  const { state, page } = useUi();
  const a = state.adapter;
  const on = a.status !== "safe-mode" && a.adapter.flags.updateCheck === true;
  useEffect(() => {
    if (on) page.checkUpdates();
  }, [on, page]);
}

function DesktopShell() {
  const { route, world } = useShownRoute();
  return (
    <div class="mls-shell">
      <Header />
      <div class="mls">
        <WorldRail route={route} />
        <MainPane route={route} world={world} />
        {route.kind === "server" ? null : <PanelColumn here={world?.id} />}
      </div>
      <Announcer />
    </div>
  );
}

export function Shell() {
  useScheduleSync();
  useUpdateCheck();
  const layout = useViewportLayout();
  return (
    <LayoutContext.Provider value={layout}>
      {layout === "desktop" ? <DesktopShell /> : <PhoneShell layout={layout} />}
    </LayoutContext.Provider>
  );
}
