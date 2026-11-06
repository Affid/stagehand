// @vitest-environment happy-dom
import type { WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent, within } from "@testing-library/preact";
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

describe("the header bar", () => {
  test("shows Foundry's name and version", () => {
    const { getByRole, container } = shell();
    expect(getByRole("heading", { name: "Foundry Virtual Tabletop" }));
    expect(el(container, ".mlh-ver").textContent).toContain("14 · 369");
  });

  test("the version opens a menu: Foundry's build, the update, and Help", () => {
    const { store, container, getByRole, queryByRole, page } = shell();
    const chip = el(container, ".mlh-ver");
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    const menu = getByRole("region", { name: "Foundry Virtual Tabletop" });
    expect(menu.textContent).toContain("Foundry 14 · build 369");
    fireEvent.click(
      within(menu).getByRole("button", { name: "Support and issues" }),
    );
    expect(sent(page.foundryAction)).toEqual([{ action: "warnings" }]);
    const kb = within(menu).getByRole("link", { name: /Knowledge base/ });
    expect(kb.getAttribute("href")).toBe("https://foundryvtt.com/kb/");
    fireEvent.click(chip);
    fireEvent.click(
      within(
        getByRole("region", { name: "Foundry Virtual Tabletop" }),
      ).getByRole("button", { name: "Update page" }),
    );
    expect(store.get().route).toEqual({ kind: "server", page: "update" });
    expect(queryByRole("region", { name: "Foundry Virtual Tabletop" })).toBe(
      null,
    );
  });

  test("an available update shows on the chip and in its menu", () => {
    const setup = withWorlds.setup;
    const { container, getByRole } = shell({
      data: {
        setup: setup && {
          ...setup,
          coreUpdate: { hasUpdate: true, channel: "stable", version: "14.371" },
        },
      },
    });
    const chip = el(container, ".mlh-ver");
    expect(chip.textContent).toContain("update");
    fireEvent.click(chip);
    const menu = getByRole("region", { name: "Foundry Virtual Tabletop" });
    expect(menu.textContent).toContain("14.371 is available");
    expect(within(menu).getByRole("button", { name: "See what's new…" }));
  });

  test("there is no way back to Foundry's page inside the extension", () => {
    const { queryByRole } = shell();
    expect(queryByRole("button", { name: "Foundry's Setup page" })).toBe(null);
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
    // Edited in place: the pencil opens the About tab.
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe("About");
    fireEvent.click(within(banner).getByRole("button", { name: "Launch" }));
    expect(sent(page.foundryAction)).toEqual([
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

  test("the rail's foot names the extension's build", () => {
    const { container } = shell();
    expect(el(container, ".mls-build").textContent).toBe("Module Library dev");
  });
});
