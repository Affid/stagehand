// Navigation in the phone and tablet layouts (Android plan, phase 3): the
// worlds list is home on a phone; every page change made by a link is
// remembered, so Back (the top bar's, or Android's) retraces it; the tab bar
// starts a fresh trail. Pure: the shell applies the patches to the store.
import type { SidePanel } from "../../store.ts";
import type { Route } from "../route.ts";
import type { Layout } from "./layout.ts";

export type PhoneTab = "worlds" | "library" | "backups" | "config";

export const PHONE_TABS: readonly PhoneTab[] = [
  "worlds",
  "library",
  "backups",
  "config",
];

export interface PhoneNav {
  /** A phone shows the worlds list instead of a page. */
  readonly home: boolean;
  /** The pages Back returns to, oldest first. */
  readonly trail: readonly Route[];
  /** The route the trail was last brought up to date with. */
  readonly at: Route | null;
}

export const START_NAV: PhoneNav = { home: true, trail: [], at: null };

/** Enough for any real path through the pages. */
const MAX_TRAIL = 20;

/** The slice of the UI state navigation reads. */
export interface NavState {
  readonly route: Route | null;
  readonly panel: string | null;
  readonly side: SidePanel | null;
  readonly phone: PhoneNav;
}

export interface NavPatch {
  readonly route?: Route | null;
  readonly panel?: null;
  readonly side?: null;
  readonly phone?: PhoneNav;
}

const key = (r: Route | null): string =>
  r === null
    ? ""
    : r.kind === "world"
      ? `world:${r.worldId}`
      : r.kind === "server"
        ? `server:${r.page}`
        : r.kind;

/**
 * The trail after the route changed to `route` (a link, a list, a menu):
 * null when nothing changed.
 */
export function synced(nav: PhoneNav, route: Route | null): PhoneNav | null {
  if (route === nav.at) return null;
  const from = nav.at;
  const keep = nav.home || from === null || key(from) === key(route);
  const trail = keep ? (nav.home ? [] : nav.trail) : [...nav.trail, from];
  return { home: false, trail: trail.slice(-MAX_TRAIL), at: route };
}

/**
 * The navigation as of the route now. The shell stores it after each
 * render; reading through this keeps Back right in between (a key pressed
 * right after a tap).
 */
export function navOf(state: Pick<NavState, "route" | "phone">): PhoneNav {
  return synced(state.phone, state.route) ?? state.phone;
}

function tabOfRoute(route: Route | null): PhoneTab {
  if (route?.kind === "library") return "library";
  if (route?.kind === "server" && route.page !== "update") return route.page;
  return "worlds";
}

/** The tab to light: the one the trail started from. */
export function currentTab(nav: PhoneNav, route: Route | null): PhoneTab {
  if (nav.home) return "worlds";
  return tabOfRoute(nav.trail[0] ?? route);
}

const isTabRoot = (route: Route | null): boolean =>
  route?.kind === "library" ||
  (route?.kind === "server" && route.page !== "update");

/** Whether the top bar offers Back (a tab's own page and home don't). */
export function hasBack(
  nav: PhoneNav,
  route: Route | null,
  layout: Layout,
): boolean {
  if (layout === "phone" && nav.home) return false;
  if (nav.trail.length > 0) return true;
  if (route?.kind === "server" && route.page === "update") return true;
  return layout === "phone" && !isTabRoot(route);
}

/** A tab's page with a fresh trail; Worlds shows the list on a phone. */
export function tabPatch(
  tab: PhoneTab,
  layout: Layout,
  state: NavState,
): NavPatch {
  const closed = { panel: null, side: null } as const;
  if (tab === "worlds" && layout === "phone")
    return { ...closed, phone: { home: true, trail: [], at: state.route } };
  const route: Route | null =
    tab === "worlds"
      ? state.route?.kind === "world"
        ? state.route
        : null
      : tab === "library"
        ? { kind: "library" }
        : { kind: "server", page: tab };
  return { route, ...closed, phone: { home: false, trail: [], at: route } };
}

/**
 * The sheet showing, if any: a module's details beside any page but a
 * server page's; the Library's own panels on the Library only (Panes.tsx).
 */
export function sheetShown(state: NavState): "panel" | "side" | null {
  const route = state.route;
  if (state.panel !== null) return route?.kind === "server" ? null : "panel";
  if (state.side !== null && route?.kind === "library") return "side";
  return null;
}

/**
 * One step back: a module's details, then the Library's panel, then the
 * trail, then from a page to its list. Null when there is nothing to go
 * back to here (Android then goes back on its own).
 */
export function backPatch(state: NavState, layout: Layout): NavPatch | null {
  const sheet = sheetShown(state);
  if (sheet) return { [sheet]: null };
  const nav = navOf(state);
  if (layout === "phone" && nav.home) return null;
  const last = nav.trail.at(-1);
  if (last)
    return {
      route: last,
      phone: { home: false, trail: nav.trail.slice(0, -1), at: last },
    };
  const route = state.route;
  if (route === null || route.kind === "world") {
    if (layout !== "phone") return null;
    return { phone: { home: true, trail: [], at: route } };
  }
  return tabPatch("worlds", layout, state);
}
