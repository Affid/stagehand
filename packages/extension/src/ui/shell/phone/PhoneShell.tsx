// The new Setup page in the phone and tablet layouts (Android plan, phase 3;
// mockup: design/setup-page/src/_phone.*): a top bar, one page at a time
// (the worlds list is home on a phone; a tablet keeps it on the left), the
// dock and the tab bar at the foot. The pages are the desktop's own; they
// render their phone forms where they read useLayout().
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useUi } from "../../context.ts";
import { Announcer } from "../Announcer.tsx";
import { MainPane, PanelColumn, useShownRoute } from "../Panes.tsx";
import { WorldRail } from "../WorldRail.tsx";
import { DockContext, SheetHostContext } from "./Dock.tsx";
import type { Layout } from "./layout.ts";
import { isNativeBack } from "./back.ts";
import { backPatch, navOf, sheetShown, synced } from "./nav.ts";
import { TipBubble, useTouchTips } from "./TouchTip.tsx";
import { SHEET, usePopupOpen } from "./popups.ts";
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
 * Escape is Back (Android's Back reaches the page as one: back.ts): open
 * dialogs and menus stop it first; a press with nothing to go back to is
 * left unhandled. In a text field only native's Back counts: a real key
 * there stays the field's, and a page script's look-alike is ignored.
 */
function useEscapeBack(layout: Layout): void {
  const { store } = useUi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(EDITABLE) && !isNativeBack(e)) return;
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

/**
 * A Next launch sheet belongs to the world shown: another world, another
 * page, or the world gone (deleted, renamed away) closes it, so the page
 * is never left inert with no sheet (review).
 */
function useNextLaunchOwner(worldId: string | undefined): void {
  const { state, store } = useUi();
  const open = state.nextLaunch;
  useEffect(() => {
    if (open !== null && open !== worldId) store.set({ nextLaunch: null });
  }, [open, worldId, store]);
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

/** Behind an open sheet the page can't be reached (keyboard, screen reader). */
function useInertBehind(
  root: { readonly current: HTMLElement | null },
  sheet: boolean,
): void {
  // A layout effect: cleared before the sheet's focus goes back to its
  // opener, which can't take focus while inert (review).
  useLayoutEffect(() => {
    const behind = root.current?.querySelectorAll<HTMLElement>(
      ":scope > .mlp-top, :scope > .mls > .mls-rail, :scope > .mls > .mls-main, :scope > .mlp-dock, :scope > .mlp-tabs",
    );
    behind?.forEach((el) => {
      el.inert = sheet;
    });
    return () => {
      behind?.forEach((el) => {
        el.inert = false;
      });
    };
  }, [root, sheet]);
}

/** Whether a world's banner has scrolled away under the top bar. */
function bannerScrolledAway(host: HTMLElement): boolean {
  const main = host.querySelector<HTMLElement>(":scope > .mls > .mls-main");
  const banner = main?.querySelector<HTMLElement>(".mls-banner");
  const bar = host.querySelector<HTMLElement>(":scope > .mlp-top");
  if (!main || !banner) return false;
  return main.scrollTop > banner.offsetHeight - (bar?.offsetHeight ?? 0);
}

/**
 * A world's page on a phone: the top bar lies over the banner's picture and
 * turns solid, with the world's name, once the banner has scrolled away.
 * Checked on every scroll and after every render (another page, another
 * world).
 */
function useBannerGone(root: { readonly current: HTMLElement | null }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const host = root.current;
    if (!host) return undefined;
    const check = (): void => {
      setGone(bannerScrolledAway(host));
    };
    host.addEventListener("scroll", check, true);
    return () => {
      host.removeEventListener("scroll", check, true);
    };
  }, [root]);
  useEffect(() => {
    if (root.current) setGone(bannerScrolledAway(root.current));
  });
  return gone;
}

function pageName(route: ReturnType<typeof useShownRoute>["route"]): string {
  return route.kind === "server" ? route.page : route.kind;
}

export function PhoneShell(props: { readonly layout: Layout }) {
  const { state } = useUi();
  const { layout } = props;
  const { route, world } = useShownRoute();
  useNextLaunchOwner(world?.id);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [sheets, setSheets] = useState<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useTrail();
  useEscapeBack(layout);
  useCompactNotice();
  useInertBehind(root, sheetShown(state) !== null);
  const popup = usePopupOpen(root, SHEET);
  const tip = useTouchTips(root);
  const bannerGone = useBannerGone(root);
  const home = layout === "phone" && navOf(state).home;
  return (
    <DockContext.Provider value={dock}>
      <SheetHostContext.Provider value={sheets}>
        <div
          ref={root}
          class={`mls-shell mlp${layout === "tablet" ? " mlp-wide" : ""}${bannerGone ? " mlp-scrolled" : ""}`}
          data-screen={home ? "home" : "page"}
          data-page={pageName(route)}
          inert={state.launching !== null}
        >
          <PhoneTop layout={layout} route={route} world={world} />
          <div class="mls">
            <WorldRail route={route} />
            <MainPane route={route} world={world} />
            {route.kind === "server" ? null : <PanelColumn here={world?.id} />}
          </div>
          <div class="mlp-sheets" ref={setSheets} />
          <div class="mlp-dock" ref={setDock} />
          <TabBar layout={layout} />
          {popup ? <div class="mlp-scrim pop" aria-hidden="true" /> : null}
          <TipBubble tip={tip} />
          <Announcer />
        </div>
      </SheetHostContext.Provider>
    </DockContext.Provider>
  );
}
