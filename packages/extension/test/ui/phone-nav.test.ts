// The phone layout's navigation (Android plan, phase 3): the worlds list as
// home, the trail Back follows, the tab bar.
import { describe, expect, test } from "vitest";
import {
  backPatch,
  currentTab,
  hasBack,
  navOf,
  START_NAV,
  synced,
  tabPatch,
  type PhoneNav,
} from "../../src/ui/shell/phone/nav.ts";
import type { Route } from "../../src/ui/shell/route.ts";

const lib: Route = { kind: "library" };
const w1: Route = { kind: "world", worldId: "w1" };
const w2: Route = { kind: "world", worldId: "w2" };
const update: Route = { kind: "server", page: "update" };
const backups: Route = { kind: "server", page: "backups" };

const nav = (over: Partial<PhoneNav> = {}): PhoneNav => ({
  ...START_NAV,
  ...over,
});

const at = (
  route: Route | null,
  over: Partial<{ panel: string | null; side: { kind: "intake" } | null }> = {},
  phone: PhoneNav = nav({ home: false, at: route }),
) => ({ route, panel: null, side: null, phone, ...over });

describe("synced: following route changes", () => {
  test("an unchanged route needs nothing", () => {
    expect(synced(nav({ at: w1 }), w1)).toBeNull();
  });

  test("leaving home opens the page, with nothing to go back to but home", () => {
    expect(synced(nav({ at: w1 }), w2)).toEqual(
      nav({ home: false, trail: [], at: w2 }),
    );
  });

  test("going on from a page remembers it", () => {
    const from = nav({ home: false, at: lib });
    expect(synced(from, w1)).toEqual(
      nav({ home: false, trail: [lib], at: w1 }),
    );
  });

  test("the same page again (a new object) isn't remembered twice", () => {
    const from = nav({ home: false, at: w1 });
    expect(synced(from, { kind: "world", worldId: "w1" })).toEqual(
      nav({ home: false, trail: [], at: { kind: "world", worldId: "w1" } }),
    );
  });

  test("the trail keeps the last 20", () => {
    const long = Array.from({ length: 20 }, (_, i): Route => ({
      kind: "world",
      worldId: `x${String(i)}`,
    }));
    const next = synced(nav({ home: false, trail: long, at: lib }), w1);
    expect(next?.trail).toHaveLength(20);
    expect(next?.trail.at(-1)).toBe(lib);
  });
});

describe("navOf: the navigation as of the route now", () => {
  test("a route not yet synced counts as followed", () => {
    expect(navOf({ route: w2, phone: nav({ at: w1 }) })).toEqual(
      nav({ home: false, trail: [], at: w2 }),
    );
    const same = nav({ at: w1 });
    expect(navOf({ route: w1, phone: same })).toBe(same);
  });

  test("Back right after a tap goes back from the page just opened", () => {
    const s = at(w2, {}, nav({ at: w1 }));
    expect(backPatch(s, "phone")).toEqual({
      phone: nav({ home: true, trail: [], at: w2 }),
    });
  });
});

describe("currentTab", () => {
  test("home and worlds are Worlds", () => {
    expect(currentTab(nav(), w1)).toBe("worlds");
    expect(currentTab(nav({ home: false }), w1)).toBe("worlds");
  });

  test("the tab the trail started from stays lit", () => {
    expect(currentTab(nav({ home: false, trail: [lib] }), w1)).toBe("library");
    expect(currentTab(nav({ home: false, trail: [] }), backups)).toBe(
      "backups",
    );
    expect(
      currentTab(nav({ home: false }), { kind: "server", page: "config" }),
    ).toBe("config");
  });

  test("What's new opened from home belongs to Worlds", () => {
    expect(currentTab(nav({ home: false }), update)).toBe("worlds");
  });
});

describe("hasBack: the top bar's Back", () => {
  test("none at home, on a tab's own page, or on a tablet's world", () => {
    expect(hasBack(nav(), w1, "phone")).toBe(false);
    expect(hasBack(nav({ home: false }), lib, "phone")).toBe(false);
    expect(hasBack(nav({ home: false }), backups, "phone")).toBe(false);
    expect(hasBack(nav({ home: false }), w1, "tablet")).toBe(false);
  });

  test("on a world, on What's new, and after following a link", () => {
    expect(hasBack(nav({ home: false }), w1, "phone")).toBe(true);
    expect(hasBack(nav({ home: false }), update, "phone")).toBe(true);
    expect(hasBack(nav({ home: false }), update, "tablet")).toBe(true);
    expect(hasBack(nav({ home: false, trail: [lib] }), backups, "phone")).toBe(
      true,
    );
  });
});

describe("backPatch: Android's Back", () => {
  test("a module's details close first, then the Library's panel", () => {
    expect(backPatch(at(lib, { panel: "a" }), "phone")).toEqual({
      panel: null,
    });
    expect(backPatch(at(lib, { side: { kind: "intake" } }), "phone")).toEqual({
      side: null,
    });
  });

  test("then the trail, one step at a time", () => {
    const s = at(w1, {}, nav({ home: false, trail: [backups, lib], at: w1 }));
    expect(backPatch(s, "phone")).toEqual({
      route: lib,
      phone: nav({ home: false, trail: [backups], at: lib }),
    });
  });

  test("a world goes back to the worlds list", () => {
    expect(backPatch(at(w1), "phone")).toEqual({
      phone: nav({ home: true, trail: [], at: w1 }),
    });
  });

  test("a tab's own page goes back to Worlds", () => {
    expect(backPatch(at(lib), "phone")).toEqual({
      panel: null,
      side: null,
      phone: nav({ home: true, trail: [], at: lib }),
    });
  });

  test("at home Back is left to Android", () => {
    expect(backPatch(at(w1, {}, nav({ at: w1 })), "phone")).toBeNull();
  });

  test("on a tablet a world is home", () => {
    expect(backPatch(at(w1), "tablet")).toBeNull();
    expect(backPatch(at(lib), "tablet")).toEqual({
      route: null,
      panel: null,
      side: null,
      phone: nav({ home: false, trail: [], at: null }),
    });
  });
});

describe("tabPatch: the tab bar", () => {
  test("Worlds on a phone shows the list and keeps the route", () => {
    expect(tabPatch("worlds", "phone", at(lib))).toEqual({
      panel: null,
      side: null,
      phone: nav({ home: true, trail: [], at: lib }),
    });
  });

  test("Worlds on a tablet shows the world, or the first one", () => {
    expect(tabPatch("worlds", "tablet", at(w1)).route).toBe(w1);
    expect(tabPatch("worlds", "tablet", at(backups)).route).toBeNull();
  });

  test("another tab opens its page with an empty trail", () => {
    const p = tabPatch("library", "phone", at(w1));
    expect(p.route).toEqual(lib);
    expect(p.phone).toEqual(
      nav({ home: false, trail: [], at: p.route ?? null }),
    );
    expect(tabPatch("backups", "phone", at(w1)).route).toEqual(backups);
    expect(tabPatch("config", "phone", at(w1)).route).toEqual({
      kind: "server",
      page: "config",
    });
  });
});
