// The new Setup page in the phone and tablet layouts (Android plan, phase 3;
// mockup: design/setup-page/src/_phone.*): a top bar, one page at a time
// (the worlds list is home on a phone; a tablet keeps it on the left), the
// dock and the tab bar at the foot. The pages are the desktop's own; they
// render their phone forms where they read useLayout().
import { useEffect, useRef, useState } from "preact/hooks";
import { useUi } from "../../context.ts";
import { Announcer } from "../Announcer.tsx";
import { MainPane, PanelColumn, useShownRoute } from "../Panes.tsx";
import { WorldRail } from "../WorldRail.tsx";
import { DockContext } from "./Dock.tsx";
import type { Layout } from "./layout.ts";
import { backPatch, navOf, synced } from "./nav.ts";
import { PhoneTop } from "./PhoneTop.tsx";
import { TabBar } from "./TabBar.tsx";

const EDITABLE = "input, textarea, select, [contenteditable]";

/**
 * Every page change made by a link or a list joins the trail Back retraces.
 * Changes made while the desktop layout was on aren't: coming into this
 * layout starts a fresh trail at the page shown (review).
 */
function useTrail(): void {
  const { state, store } = useUi();
  const first = useRef(true);
  useEffect(() => {
    const s = store.get();
    if (first.current) {
      first.current = false;
      if (s.phone.at !== s.route)
        store.set({ phone: { ...s.phone, trail: [], at: s.route } });
      return;
    }
    const next = synced(s.phone, s.route);
    if (next) store.set({ phone: next });
  }, [state.route, store]);
}

/**
 * Escape is Back (Android's Back reaches the page as one, phase 4): open
 * dialogs and menus stop it first; a press with nothing to go back to is
 * left unhandled. A real key in a text field stays the field's.
 */
function useEscapeBack(layout: Layout): void {
  const { store } = useUi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      if (e.isTrusted && target?.closest(EDITABLE)) return;
      const patch = backPatch(store.get(), layout);
      if (!patch) return;
      e.preventDefault();
      e.stopPropagation();
      store.set(patch);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [store, layout]);
}

/** Foundry's window-size notice goes while this layout is on. */
function useCompactNotice(): void {
  const { page } = useUi();
  useEffect(() => {
    page.setCompact(true);
    return () => {
      page.setCompact(false);
    };
  }, [page]);
}

function pageName(route: ReturnType<typeof useShownRoute>["route"]): string {
  return route.kind === "server" ? route.page : route.kind;
}

export function PhoneShell(props: { readonly layout: Layout }) {
  const { state } = useUi();
  const { layout } = props;
  const { route, world } = useShownRoute();
  const [dock, setDock] = useState<HTMLElement | null>(null);
  useTrail();
  useEscapeBack(layout);
  useCompactNotice();
  const home = layout === "phone" && navOf(state).home;
  return (
    <DockContext.Provider value={dock}>
      <div
        class={`mls-shell mlp${layout === "tablet" ? " mlp-wide" : ""}`}
        data-screen={home ? "home" : "page"}
        data-page={pageName(route)}
      >
        <PhoneTop layout={layout} route={route} world={world} />
        <div class="mls">
          <WorldRail route={route} />
          <MainPane route={route} world={world} />
          {route.kind === "server" ? null : <PanelColumn here={world?.id} />}
        </div>
        <div class="mlp-dock" ref={setDock} />
        <TabBar layout={layout} />
        <Announcer />
      </div>
    </DockContext.Provider>
  );
}
