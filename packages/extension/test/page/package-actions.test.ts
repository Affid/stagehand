// @vitest-environment happy-dom
// Foundry's card-menu actions on modules and systems (6b): favourite, lock,
// update, backup and uninstall, as SetupPackages runs them.
import { describe, expect, test, vi } from "vitest";
import { parsePageToUi, parseUiToPage } from "../../src/page-protocol.ts";
import { runFoundryAction } from "../../src/page/actions.ts";
import { checkUpdates } from "../../src/page/updates.ts";

function foundry() {
  const mod = { id: "m", version: "1.0.0", favorite: false, locked: false };
  const sys = { id: "dnd5e", version: "6.0.6" };
  const store: Record<string, unknown> = {
    setupPackageFavorites: { worlds: [], modules: ["x"], systems: [] },
  };
  const game = {
    modules: {
      get: (id: string) => (id === "m" ? mod : undefined),
      values: () => [mod].values(),
    },
    systems: {
      get: (id: string) => (id === "dnd5e" ? sys : undefined),
      values: () => [sys].values(),
    },
    settings: {
      get: (_n: string, k: string) => store[k],
      set: vi.fn((_n: string, k: string, v: unknown) => {
        store[k] = v;
        return Promise.resolve();
      }),
    },
    post: vi.fn(() => Promise.resolve({})),
    createBackup: vi.fn(() => Promise.resolve(true)),
    uninstallPackage: vi.fn(() => Promise.resolve()),
  };
  const render = vi.fn();
  return {
    page: { game, ui: { setupPackages: { render } } } as never,
    game,
    mod,
    store,
    render,
  };
}

const act = (action: string, id = "m", packageType = "module") =>
  ({ action, packageType, id }) as never;

describe("Foundry's actions on a module", () => {
  test("favourite flips Foundry's own setting for modules, then re-renders", async () => {
    const f = foundry();
    expect(
      await runFoundryAction(document, f.page, act("favoritePackage")),
    ).toBeUndefined();
    expect(f.store.setupPackageFavorites).toEqual({
      worlds: [],
      modules: ["x", "m"],
      systems: [],
    });
    expect(f.mod.favorite).toBe(true);
    expect(f.render).toHaveBeenCalled();
  });

  test("lock posts Foundry's lockPackage for its type", async () => {
    const f = foundry();
    await runFoundryAction(document, f.page, act("lockPackage"));
    expect(f.game.post).toHaveBeenCalledWith({
      action: "lockPackage",
      type: "module",
      id: "m",
      shouldLock: true,
    });
    expect(f.mod.locked).toBe(true);
  });

  test("backup and uninstall go to Foundry's own dialogs", async () => {
    const f = foundry();
    await runFoundryAction(document, f.page, act("backupPackage"));
    expect(f.game.createBackup).toHaveBeenCalledWith(f.mod, { dialog: true });
    await runFoundryAction(document, f.page, act("uninstallPackage"));
    expect(f.game.uninstallPackage).toHaveBeenCalledWith(f.mod);
  });

  test("update clicks that package's own update control, and only its", async () => {
    document.body.innerHTML = `<div id="setup-packages"><section data-package-type="module">
      <li class="package" data-package-id="m"><a data-action="updatePackage"></a></li>
      <li class="package" data-package-id="n"><a data-action="updatePackage"></a></li></section></div>`;
    const clicked = vi.fn();
    document
      .querySelector('[data-package-id="m"] a')
      ?.addEventListener("click", clicked);
    expect(
      await runFoundryAction(document, {}, act("updatePackage")),
    ).toBeUndefined();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(
      await runFoundryAction(document, {}, act("updatePackage", "zzz")),
    ).toMatch(/missing/);
  });

  test("an unknown package is reported, never thrown", async () => {
    const f = foundry();
    expect(
      await runFoundryAction(document, f.page, act("favoritePackage", "nope")),
    ).toBe("No module nope");
  });
});

describe("package actions are checked", () => {
  test("a type and a package id, nothing else", () => {
    expect(
      parseUiToPage("FOUNDRY_ACTION", {
        action: "lockPackage",
        packageType: "system",
        id: "dnd5e",
      }),
    ).toEqual({
      type: "FOUNDRY_ACTION",
      payload: { action: "lockPackage", packageType: "system", id: "dnd5e" },
    });
    for (const bad of [
      { action: "lockPackage", packageType: "world", id: "w" },
      { action: "lockPackage", packageType: "module", id: "../x" },
      { action: "lockPackage", packageType: "module", id: "m", extra: 1 },
      { action: "updatePackage", packageType: "module" },
    ])
      expect(parseUiToPage("FOUNDRY_ACTION", bad)).toBeUndefined();
  });
});

describe("the update check (6b)", () => {
  test("newer and installable here, from Foundry's own package list", async () => {
    const f = foundry();
    const listed = new Map([
      ["m", { version: "1.2.0", availability: 1 }],
      ["dnd5e", { version: "7.0.0", availability: 8 }],
    ]);
    const page = {
      game: { ...f.game, getPackages: vi.fn(() => Promise.resolve(listed)) },
      foundry: {
        utils: {
          isNewerVersion: (a: string, b: string) =>
            a.localeCompare(b, undefined, { numeric: true }) > 0,
        },
      },
    } as never;
    expect(await checkUpdates(page)).toEqual({
      module: { m: "1.2.0" },
      system: {},
    });
  });

  test("no list, no updates; a failure is logged, not thrown", async () => {
    const f = foundry();
    const page = {
      game: {
        ...f.game,
        getPackages: vi.fn(() => Promise.reject(new Error("offline"))),
      },
      foundry: { utils: { isNewerVersion: () => true } },
    } as never;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await checkUpdates(page)).toBeUndefined();
    expect(await checkUpdates({ game: f.game })).toBeUndefined();
  });

  test("the answer is checked: ids and versions only", () => {
    expect(parseUiToPage("CHECK_UPDATES", {})?.type).toBe("CHECK_UPDATES");
    const ok = parsePageToUi("UPDATES", {
      module: { m: "1.2.0", constructor: "2.0.0" },
      system: {},
    });
    expect(ok?.type).toBe("UPDATES");
    const updates = ok?.payload as { module: Record<string, string> };
    expect(updates.module.constructor).toBe("2.0.0");
    expect(updates.module.toString).toBeUndefined();
    expect(
      parsePageToUi("UPDATES", { module: { m: "<b>" }, system: {} }),
    ).toBeUndefined();
    expect(
      parsePageToUi("UPDATES", { module: { "../x": "1" }, system: {} }),
    ).toBeUndefined();
    expect(parsePageToUi("UPDATES", { module: {} })).toBeUndefined();
  });
});

describe("Edit manifest, through Foundry's own card menu (6b2)", () => {
  test("its menu on the hidden card, its edit item by icon", async () => {
    document.body.innerHTML = `<div id="setup-packages"><section data-package-type="module">
      <li class="package" data-package-id="m"></li></section></div>`;
    const card = document.querySelector("li.package");
    card?.addEventListener("contextmenu", () => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<nav id="context-menu"><li class="context-item"><i class="fa-edit"></i>Edit</li></nav>`,
      );
    });
    const clicked = vi.fn();
    document.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".context-item")) clicked();
    });
    const page = {
      foundry: { applications: { instances: new Map() } },
    } as never;
    expect(
      await runFoundryAction(document, page, act("editPackage")),
    ).toBeUndefined();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  test("a system has no editor; a missing card is reported", async () => {
    document.body.innerHTML = "";
    expect(
      await runFoundryAction(
        document,
        {},
        act("editPackage", "dnd5e", "system"),
      ),
    ).toMatch(/no editor/);
    expect(await runFoundryAction(document, {}, act("editPackage"))).toMatch(
      /missing/,
    );
  });
});
