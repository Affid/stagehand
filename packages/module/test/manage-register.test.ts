// @vitest-environment happy-dom
// The library view set up from the companion's entry: its setting, the
// library read once per page, Module Management taken over for a
// Gamemaster and left alone for a player.
import { emptyLibrary } from "@stagehand/shared/library/schema";
import { serializeSyncFile } from "@stagehand/shared/library/sync-file";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FoundryGlobals } from "../src/foundry.ts";
import { registerModuleView } from "../src/manage/register.ts";
import { fakeGame } from "./fakes.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const FILE = serializeSyncFile(
  { side: { library: emptyLibrary("s"), sorted: [] }, id: "f1", history: [] },
  "2026-11-19T10:00:00.000Z",
);

const moduleClass = { DEFAULT_OPTIONS: { window: { resizable: false } } };

function globals(role: number, setting: unknown = true) {
  moduleClass.DEFAULT_OPTIONS.window.resizable = false;
  const { game } = fakeGame(
    [
      { id: "stagehand", active: true },
      { id: "a", active: true },
    ],
    role,
  );
  vi.spyOn(game.settings, "get").mockImplementation((ns, key) =>
    ns === "stagehand" && key === "libraryView" ? setting : undefined,
  );
  const once = new Map<string, () => void>();
  const on = new Map<string, (...args: unknown[]) => void>();
  const g = {
    game,
    CONST: { USER_ROLES: { GAMEMASTER: 4 } },
    Hooks: {
      once: (name: string, fn: () => void) => (once.set(name, fn), 1),
      on: (name: string, fn: (...args: unknown[]) => void) => (
        on.set(name, fn),
        1
      ),
      callAll: () => true,
    },
    ui: { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    foundry: {
      applications: {
        api: { DialogV2: { wait: vi.fn() } },
        sidebar: { apps: { ModuleManagement: moduleClass } },
      },
      utils: { debouncedReload: vi.fn(), getRoute: (p: string) => `/${p}` },
    },
  } as unknown as FoundryGlobals;
  const fetch = vi.fn(() => Promise.resolve(new Response(FILE)));
  vi.stubGlobal("fetch", fetch);
  registerModuleView(g);
  return { g, game, once, on, fetch };
}

function moduleWindow() {
  const element = document.createElement("form");
  element.innerHTML =
    '<section class="window-content"><input type="checkbox" name="a"></section>';
  document.body.append(element);
  const app = { options: { form: { handler: vi.fn() } }, setPosition: vi.fn() };
  return { app, element };
}

describe("registerModuleView", () => {
  it("registers the per-user setting, on by default", () => {
    const { game, once } = globals(4);

    once.get("init")?.();

    expect(game.settings.register).toHaveBeenCalledWith(
      "stagehand",
      "libraryView",
      expect.objectContaining({
        scope: "user",
        config: true,
        type: Boolean,
        default: true,
      }),
    );
  });

  it("draws the view in Module Management for a Gamemaster", async () => {
    // Arrange
    const { once, on, fetch } = globals(3);
    once.get("ready")?.();
    const w = moduleWindow();

    // Act
    on.get("renderModuleManagement")?.(
      w.app,
      w.element,
      {},
      { isFirstRender: true },
    );

    // Assert
    await vi.waitFor(() => {
      expect(w.element.querySelector(".stagehand-view")).not.toBeNull();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.getElementById("stagehand-view-css")).not.toBeNull();
  });

  it("leaves Module Management alone for a player, without reading anything", async () => {
    const { once, on, fetch } = globals(1);
    once.get("ready")?.();
    const w = moduleWindow();

    on.get("renderModuleManagement")?.(
      w.app,
      w.element,
      {},
      { isFirstRender: true },
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(w.element.querySelector('input[name="a"]')).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("leaves Module Management alone when the setting is off", async () => {
    const { on } = globals(4, false);
    const w = moduleWindow();

    on.get("renderModuleManagement")?.(
      w.app,
      w.element,
      {},
      { isFirstRender: true },
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(w.element.querySelector('input[name="a"]')).not.toBeNull();
  });

  it("removes the view when the window closes", async () => {
    const { on } = globals(4);
    const w = moduleWindow();
    on.get("renderModuleManagement")?.(
      w.app,
      w.element,
      {},
      { isFirstRender: true },
    );
    await vi.waitFor(() => {
      expect(w.element.querySelector(".stagehand-view")).not.toBeNull();
    });

    on.get("closeModuleManagement")?.(w.app);

    expect(w.element.querySelector(".stagehand-view")).toBeNull();
  });

  it("tries the library again after a failed read", async () => {
    const { once, on, fetch } = globals(4);
    fetch.mockResolvedValueOnce(new Response("busy", { status: 503 }));
    once.get("ready")?.();
    // The read at load fails and is done before the window opens.
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    await new Promise((r) => setTimeout(r, 10));
    const w = moduleWindow();

    on.get("renderModuleManagement")?.(
      w.app,
      w.element,
      {},
      { isFirstRender: true },
    );

    await vi.waitFor(() => {
      expect(w.element.querySelector(".stagehand-view")).not.toBeNull();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("makes Module Management resizable once the library is read, for a Gamemaster", async () => {
    const { once } = globals(4);

    once.get("ready")?.();

    await vi.waitFor(() => {
      expect(moduleClass.DEFAULT_OPTIONS.window.resizable).toBe(true);
    });
  });

  it("leaves Foundry's window as it is for a player, or with the setting off", async () => {
    const player = globals(1);
    player.once.get("ready")?.();
    await new Promise((r) => setTimeout(r, 20));
    expect(moduleClass.DEFAULT_OPTIONS.window.resizable).toBe(false);

    const off = globals(4, false);
    off.once.get("ready")?.();
    await new Promise((r) => setTimeout(r, 20));
    expect(moduleClass.DEFAULT_OPTIONS.window.resizable).toBe(false);
  });

  it("gives Foundry back its own window when the setting is turned off", async () => {
    const { game, once } = globals(4);
    once.get("init")?.();
    once.get("ready")?.();
    await vi.waitFor(() => {
      expect(moduleClass.DEFAULT_OPTIONS.window.resizable).toBe(true);
    });
    const config = vi
      .mocked(game.settings.register)
      .mock.calls.find((c) => c[1] === "libraryView")?.[2] as {
      onChange: (on: boolean) => void;
    };

    config.onChange(false);

    expect(moduleClass.DEFAULT_OPTIONS.window.resizable).toBe(false);
  });
});
