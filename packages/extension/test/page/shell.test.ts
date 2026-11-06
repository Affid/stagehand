// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { runFoundryAction } from "../../src/page/actions.ts";
import { SHELL_CLASS, setShell } from "../../src/page/shell.ts";

const setupPage = () => {
  document.body.className = "";
  document.head.innerHTML = "";
  document.body.innerHTML = `
    <header id="main-header"></header><div id="watermark"></div>
    <nav id="setup-menu"><button data-action="viewWarnings"></button>
      <button data-action="adminLogout"></button><button data-action="shutDown"></button></nav>
    <section id="setup"><div id="setup-packages"><button data-action="worldCreate"></button>
      <ol id="worlds-list"><li class="package world" data-package-id="strahd"><a data-action="worldLaunch"></a></li></ol></div></section>`;
};

describe("taking over Foundry's Setup layout", () => {
  beforeEach(setupPage);

  test("on hides Foundry's layout with one style and a body class; off gives it back", () => {
    expect(setShell(document, true)).toEqual({ on: true });
    expect(document.body.classList.contains(SHELL_CLASS)).toBe(true);
    expect(document.querySelectorAll("style#ml-shell-style")).toHaveLength(1);
    // Only while our page is mounted: if the UI script dies, Foundry's page shows.
    expect(document.getElementById("ml-shell-style")?.textContent).toContain(
      ":has(#ml-shell-root)",
    );
    setShell(document, true);
    expect(document.querySelectorAll("style#ml-shell-style")).toHaveLength(1);
    expect(setShell(document, false)).toEqual({ on: false });
    expect(document.body.classList.contains(SHELL_CLASS)).toBe(false);
  });

  test("refuses, and changes nothing, when Foundry's layout isn't there", () => {
    document.getElementById("setup")?.remove();
    const r = setShell(document, true);
    expect(r.on).toBe(false);
    expect(r.error).toMatch(/#setup/);
    expect(document.body.classList.contains(SHELL_CLASS)).toBe(false);
  });
});

describe("Foundry actions on its own controls", () => {
  beforeEach(setupPage);
  const clicks = () => {
    const seen: string[] = [];
    document.body.addEventListener(
      "click",
      (e) => seen.push((e.target as HTMLElement).dataset.action ?? ""),
      true,
    );
    return seen;
  };

  test("server actions click Foundry's hidden menu buttons", async () => {
    const seen = clicks();
    for (const action of [
      "warnings",
      "logout",
      "shutdown",
      "createWorld",
    ] as const)
      expect(await runFoundryAction(document, {}, { action })).toBeUndefined();
    expect(seen).toEqual([
      "viewWarnings",
      "adminLogout",
      "shutDown",
      "worldCreate",
    ]);
  });

  test("launch clicks that world's own launch control, and only that world's", async () => {
    const seen = clicks();
    expect(
      await runFoundryAction(
        document,
        {},
        { action: "launch", worldId: "strahd" },
      ),
    ).toBeUndefined();
    expect(seen).toEqual(["worldLaunch"]);
    expect(
      await runFoundryAction(
        document,
        {},
        { action: "launch", worldId: "nope" },
      ),
    ).toMatch(/launch/i);
  });

  test("Support and issues opens Foundry's Package Warnings, moved into view", async () => {
    const seen = clicks();
    const setPosition = vi.fn();
    const instances = new Map([
      [
        "setup-warnings",
        { rendered: true, position: { width: 600 }, setPosition },
      ],
    ]);
    const page = { foundry: { applications: { instances } } };
    expect(
      await runFoundryAction(document, page, { action: "warnings" }),
    ).toBeUndefined();
    expect(seen).toEqual(["viewWarnings"]);
    // Foundry places it under its own (hidden) menu: off screen.
    await vi.waitFor(() => {
      expect(setPosition).toHaveBeenCalledWith(
        expect.objectContaining({ top: 80 }),
      );
    });
  });

  test("a missing control is reported, never thrown", async () => {
    document.getElementById("setup-menu")?.remove();
    expect(
      await runFoundryAction(document, {}, { action: "warnings" }),
    ).toMatch(/warnings/);
  });

  test("Back up first: Foundry's own backup, then the world's launch control", async () => {
    const seen = clicks();
    const world = { id: "strahd", type: "world", title: "Strahd" };
    const createBackup = vi.fn(() => Promise.resolve(true));
    const page = {
      game: {
        worlds: { values: () => [].values(), get: () => world },
        createBackup,
      },
    };
    expect(
      await runFoundryAction(document, page, {
        action: "backupLaunch",
        worldId: "strahd",
        note: "Before queued changes",
      }),
    ).toBeUndefined();
    expect(createBackup).toHaveBeenCalledWith(world, {
      note: "Before queued changes",
    });
    expect(seen).toEqual(["worldLaunch"]);
  });

  test("a backup that doesn't finish stops the launch", async () => {
    const seen = clicks();
    const page = {
      game: {
        worlds: { values: () => [].values(), get: () => ({ id: "strahd" }) },
        createBackup: () => Promise.resolve(false),
      },
    };
    expect(
      await runFoundryAction(document, page, {
        action: "backupLaunch",
        worldId: "strahd",
      }),
    ).toMatch(/not launched/i);
    expect(seen).toEqual([]);
  });

  test("favourite toggles Foundry's own setting, as its card menu does", async () => {
    const store: Record<string, unknown> = {
      setupPackageFavorites: { worlds: ["other"], modules: [], systems: [] },
    };
    const set = vi.fn((_ns: string, key: string, v: unknown) => {
      store[key] = v;
      return Promise.resolve();
    });
    const world = { id: "strahd", favorite: false };
    const rerender = vi.fn();
    const page = {
      game: {
        worlds: { values: () => [].values(), get: () => world },
        settings: { get: (_ns: string, key: string) => store[key], set },
      },
      ui: { setupPackages: { render: rerender } },
    };
    await runFoundryAction(document, page, {
      action: "favorite",
      worldId: "strahd",
    });
    expect(store.setupPackageFavorites).toEqual({
      worlds: ["other", "strahd"],
      modules: [],
      systems: [],
    });
    expect(world.favorite).toBe(true);
    expect(rerender).toHaveBeenCalled();
    await runFoundryAction(document, page, {
      action: "favorite",
      worldId: "strahd",
    });
    expect(store.setupPackageFavorites).toEqual({
      worlds: ["other"],
      modules: [],
      systems: [],
    });
    expect(world.favorite).toBe(false);
  });
});
