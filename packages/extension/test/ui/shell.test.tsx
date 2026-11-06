// @vitest-environment happy-dom
import type { WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { el, renderUi, sent, setupState } from "./harness.tsx";

afterEach(cleanup);

const world = (id: string, over: Partial<WorldInfo> = {}): WorldInfo => ({
  id,
  title: `World ${id}`,
  system: "dnd5e",
  systemVersion: "5",
  coreVersion: "14.370",
  ...over,
});

const WORLDS = [
  world("old", { title: "Old Campaign", lastPlayed: "2026-01-01T00:00:00Z" }),
  world("strahd", {
    title: "Curse of Strahd",
    favorite: true,
    locked: true,
    lastPlayed: "2026-10-01T00:00:00Z",
  }),
  world("new", { title: "New One", lastPlayed: "2026-11-01T00:00:00Z" }),
];

const base = setupState();
const withWorlds = {
  setup: base.setup ? { ...base.setup, worlds: WORLDS } : undefined,
};

const shell = (over: Parameters<typeof renderUi>[1] = {}) =>
  renderUi("shell", { data: withWorlds, ...over });

const railTitles = (container: ParentNode): string[] =>
  [...container.querySelectorAll(".mls-world strong")].map(
    (s) => s.textContent,
  );

describe("switching to the new Setup page", () => {
  test("the Module Library toolbar offers it and saves the choice", async () => {
    const { getByRole, send, store } = renderUi("modules", {
      reply: (m) => (m.kind === "set-pref" ? undefined : { ok: true }),
    });
    fireEvent.click(getByRole("button", { name: "Try the new Setup page" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "set-pref",
        key: "newSetupPage",
        value: true,
      });
    });
    await waitFor(() => {
      expect(store.get().data.prefs.newSetupPage).toBe(true);
    });
  });

  test("safe mode doesn't offer it", () => {
    const { queryByRole } = renderUi("modules", {
      state: { adapter: { status: "safe-mode" } },
    });
    expect(queryByRole("button", { name: "Try the new Setup page" })).toBe(
      null,
    );
  });

  test("a failed save is reported and the choice stays as it was", async () => {
    const { getByRole, store, page } = renderUi("modules", {
      reply: (m) => {
        if (m.kind === "set-pref") throw new Error("storage full");
        return { ok: true };
      },
    });
    fireEvent.click(getByRole("button", { name: "Try the new Setup page" }));
    await waitFor(() => {
      expect(page.notify).toHaveBeenCalled();
    });
    expect(store.get().data.prefs.newSetupPage).toBe(false);
  });
});

describe("the header bar", () => {
  test("shows Foundry's name and version", () => {
    const { getByRole, container } = shell();
    expect(getByRole("heading", { name: "Foundry Virtual Tabletop" }));
    expect(el(container, ".mlh-ver").textContent).toContain("14 · 369");
  });

  test("Backups, Configuration and the version open Foundry's own screens", () => {
    const { getByRole, page, container } = shell();
    fireEvent.click(getByRole("button", { name: "Backups" }));
    fireEvent.click(getByRole("button", { name: "Configuration" }));
    fireEvent.click(el(container, ".mlh-ver"));
    expect(sent(page.foundryAction)).toEqual([
      { action: "backups" },
      { action: "configure" },
      { action: "update" },
    ]);
  });

  test("the power menu holds Log out and Shut down, and closes with Escape", () => {
    const { getByRole, queryByRole, page } = shell();
    const item = (name: string) => getByRole("button", { name });
    const power = getByRole("button", { name: "Log out or shut down" });
    expect(power.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(power);
    expect(power.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("button", { name: "Log out" })).toBe(null);
    expect(document.activeElement).toBe(power);
    fireEvent.click(power);
    expect(document.activeElement).toBe(item("Log out"));
    fireEvent.click(item("Log out"));
    fireEvent.click(power);
    fireEvent.click(item("Shut down the server"));
    expect(sent(page.foundryAction)).toEqual([
      { action: "logout" },
      { action: "shutdown" },
    ]);
  });

  test("Foundry's Setup page switches back", async () => {
    const { getByRole, send } = shell({
      data: { ...withWorlds, prefs: { newSetupPage: true } },
    });
    fireEvent.click(getByRole("button", { name: "Foundry's Setup page" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "set-pref",
        key: "newSetupPage",
        value: false,
      });
    });
  });
});

describe("the worlds rail", () => {
  test("lists worlds in Foundry's order: favourites, then last played", () => {
    const { container } = shell();
    expect(railTitles(container)).toEqual([
      "Curse of Strahd",
      "New One",
      "Old Campaign",
    ]);
  });

  test("marks favourites and locked worlds", () => {
    const { container } = shell();
    const strahd = el(container, '.mls-world[data-world="strahd"]');
    expect(within(strahd).getByLabelText("Favourite")).toBeTruthy();
    expect(within(strahd).getByLabelText("Locked")).toBeTruthy();
  });

  test("the filter narrows the list", () => {
    const { container, getByRole } = shell();
    fireEvent.input(getByRole("searchbox", { name: /Filter worlds/ }), {
      target: { value: "new" },
    });
    expect(railTitles(container)).toEqual(["New One"]);
  });

  test("shows queued changes and problems on the world", () => {
    const { container } = shell({
      data: {
        ...withWorlds,
        commands: [
          {
            id: "c1",
            scope: "world",
            worldId: "new",
            type: "preset.apply",
            payload: { mode: "add", presetIds: ["p1"] },
            createdAt: "2026-11-02T00:00:00Z",
            baseSnapshotAt: null,
            status: "pending",
          },
        ],
      },
    });
    const row = el(container, '.mls-world[data-world="new"]');
    expect(row.querySelector(".flag.q")?.textContent).toMatch(/1/);
    // No companion snapshot for any world: each one is flagged.
    expect(row.querySelector(".flag.a")).toBeTruthy();
  });

  test("Create World opens Foundry's own form", () => {
    const { getByRole, page } = shell();
    fireEvent.click(getByRole("button", { name: "Create World" }));
    expect(page.foundryAction).toHaveBeenCalledWith({ action: "createWorld" });
  });
});

describe("routing", () => {
  test("opens on the first world; a click opens another; Library switches", () => {
    const { container, getByRole, store } = shell();
    expect(el(container, ".mls-banner h2").textContent).toBe("Curse of Strahd");
    fireEvent.click(getByRole("button", { name: /Old Campaign/ }));
    expect(el(container, ".mls-banner h2").textContent).toBe("Old Campaign");
    expect(
      getByRole("button", { name: /Old Campaign/ }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
    fireEvent.click(getByRole("button", { name: /Library/ }));
    expect(store.get().route).toEqual({ kind: "library" });
    expect(container.querySelector(".mls-world.mls-on")).toBe(null);
    expect(container.querySelector(".mls-world[aria-current]")).toBe(null);
    expect(container.querySelector(".mls-banner")).toBe(null);
    expect(container.querySelector(".mll-page")).toBeTruthy();
  });

  test("with no worlds the Library is shown", () => {
    const { container } = renderUi("shell", {
      data: { setup: base.setup ? { ...base.setup, worlds: [] } : undefined },
    });
    expect(container.querySelector(".mll-page")).toBeTruthy();
  });
});

describe("a world's page", () => {
  test("the banner has the system, last played, Edit and Launch", () => {
    const { container, page } = shell();
    const banner = el(container, ".mls-banner");
    expect(banner.textContent).toContain("dnd5e");
    expect(banner.textContent).toMatch(/Last played/);
    fireEvent.click(within(banner).getByRole("button", { name: "Edit World" }));
    fireEvent.click(within(banner).getByRole("button", { name: "Launch" }));
    expect(sent(page.foundryAction)).toEqual([
      { action: "editWorld", worldId: "strahd" },
      { action: "launch", worldId: "strahd" },
    ]);
  });

  test("the star toggles Foundry's favourite", () => {
    const { container, page } = shell();
    const star = within(el(container, ".mls-banner")).getByRole("button", {
      name: "Favourite",
    });
    expect(star.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(star);
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "favorite",
      worldId: "strahd",
    });
  });

  test("a world the companion hasn't reported explains the setup", () => {
    const { container } = shell();
    expect(container.querySelector(".mlw-empty")).toBeTruthy();
    expect(container.querySelector(".mlw-card")).toBe(null);
  });
});
