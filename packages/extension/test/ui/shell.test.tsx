// @vitest-environment happy-dom
import type { WorldInfo } from "@stagehand/shared/world";
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
  [...container.querySelectorAll(".sts-world strong")].map(
    (s) => s.textContent,
  );

describe("the header bar", () => {
  test("shows Foundry's name and version", () => {
    const { getByRole, container } = shell();
    expect(getByRole("heading", { name: "Foundry Virtual Tabletop" }));
    expect(el(container, ".sth-ver").textContent).toContain("14 · 369");
  });

  test("the version opens a menu: Foundry's build, the update, and Help", () => {
    const { store, container, getByRole, queryByRole, page } = shell();
    const chip = el(container, ".sth-ver");
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
    const chip = el(container, ".sth-ver");
    expect(chip.textContent).toContain("update");
    // The name holds the words shown, in order (axe, label-content-name-mismatch).
    const norm = (x: string | null): string =>
      (x ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    expect(norm(chip.getAttribute("aria-label"))).toContain(
      norm(chip.textContent),
    );
    fireEvent.click(chip);
    const menu = getByRole("region", { name: "Foundry Virtual Tabletop" });
    expect(menu.textContent).toContain("14.371 is available");
    expect(within(menu).getByRole("button", { name: "See what's new…" }));
  });

  test("there is no way back to Foundry's page inside the extension", () => {
    const { queryByRole } = shell();
    expect(queryByRole("button", { name: "Foundry's Setup page" })).toBe(null);
  });

  test("no admin password: no power menu, as Foundry offers neither then (Phase 6)", () => {
    const b = setupState();
    const { queryByRole } = shell({
      data: { setup: b.setup ? { ...b.setup, passwordSet: false } : undefined },
    });
    expect(queryByRole("button", { name: "Log out or shut down" })).toBeNull();
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
    const strahd = el(container, '.sts-world[data-world="strahd"]');
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
    const row = el(container, '.sts-world[data-world="new"]');
    expect(row.querySelector(".flag.q")?.textContent).toMatch(/1/);
    // No companion snapshot for any world: each one is flagged.
    expect(row.querySelector(".flag.a")).toBeTruthy();
  });

  test("a world whose next launch has a problem is flagged with it (Phase 6)", () => {
    const { container } = shell({
      data: {
        ...withWorlds,
        snapshots: {
          new: {
            worldId: "new",
            title: "New One",
            system: { id: "dnd5e", version: "5" },
            coreVersion: "14.370",
            active: ["stagehand", "c", "lib"].map((id) => ({
              id,
              version: "1.0.0",
            })),
            companionVersion: "0.1.0",
            takenAt: "2026-11-02T00:00:00Z",
          },
        },
        commands: [
          {
            id: "c1",
            scope: "world",
            worldId: "new",
            type: "preset.apply",
            // "c" needs "lib": turning lib off is a problem at the next launch.
            payload: { mode: "remove", presetIds: [], modules: ["lib"] },
            createdAt: "2026-11-02T01:00:00Z",
            baseSnapshotAt: null,
            status: "pending",
          },
        ],
      },
    });
    const row = el(container, '.sts-world[data-world="new"]');
    const flag = el(row, ".flag.p");
    expect(flag.textContent).toContain("1 queued");
    expect(flag.getAttribute("title")).toBe("2 modules need attention");
    expect(row.querySelector(".flag.q")).toBeNull();
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
    expect(el(container, ".sts-banner h2").textContent).toContain(
      "Curse of Strahd",
    );
    fireEvent.click(getByRole("button", { name: /Old Campaign/ }));
    expect(el(container, ".sts-banner h2").textContent).toContain(
      "Old Campaign",
    );
    expect(
      getByRole("button", { name: /Old Campaign/ }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
    fireEvent.click(getByRole("button", { name: /^Library/ }));
    expect(store.get().route).toEqual({ kind: "library" });
    expect(container.querySelector(".sts-world.sts-on")).toBe(null);
    expect(container.querySelector(".sts-world[aria-current]")).toBe(null);
    expect(container.querySelector(".sts-banner")).toBe(null);
    expect(container.querySelector(".stl-page")).toBeTruthy();
  });

  test("with no worlds the Library is shown", () => {
    const { container } = renderUi("shell", {
      data: { setup: base.setup ? { ...base.setup, worlds: [] } : undefined },
    });
    expect(container.querySelector(".stl-page")).toBeTruthy();
  });
});

describe("a world's page", () => {
  test("the banner has the system, last played, Edit and Launch", () => {
    const { container, page } = shell();
    const banner = el(container, ".sts-banner");
    // The system's title, as the prototype; no core version in the banner.
    expect(banner.textContent).toContain("Dungeons & Dragons Fifth Edition");
    expect(banner.textContent).not.toContain("dnd5e");
    expect(banner.textContent).not.toContain("Core");
    expect(banner.textContent).toMatch(/Last played/);
    fireEvent.click(within(banner).getByRole("button", { name: "Edit World" }));
    // Edited in place: the pencil opens the About tab.
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe("About");
    // Strahd is locked: Launch is off, and its wrapper says why.
    const launch = within(banner).getByRole<HTMLButtonElement>("button", {
      name: "Launch",
    });
    expect(launch.disabled).toBe(true);
    expect(launch.parentElement?.getAttribute("title")).toContain("Locked");
    expect(page.foundryAction).not.toHaveBeenCalled();
  });

  test("an unlocked world launches from the banner", async () => {
    const { container, page } = shell({
      state: { route: { kind: "world", worldId: "new" } },
    });
    fireEvent.click(
      within(el(container, ".sts-banner")).getByRole("button", {
        name: "Launch",
      }),
    );
    await waitFor(() =>
      expect(sent(page.foundryAction)).toEqual([
        { action: "launch", worldId: "new" },
      ]),
    );
  });

  test("the title carries the star and the Locked tag; the star toggles Foundry's favourite", () => {
    const { container, page } = shell();
    // The heading is the bare title; the star and tag sit beside it.
    expect(el(container, ".sts-banner h2").textContent).toBe("Curse of Strahd");
    const title = el(container, ".sts-banner .sts-titlerow");
    expect(title.textContent).toContain("Locked");
    const star = within(title).getByRole("button", { name: "Favourite" });
    expect(star.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(star);
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "favorite",
      worldId: "strahd",
    });
  });

  test("a world the companion hasn't reported explains the setup", () => {
    const { container } = shell();
    expect(container.querySelector(".stw-empty")).toBeTruthy();
    expect(container.querySelector(".stw-card")).toBe(null);
  });

  test("the rail's foot names the extension's build", () => {
    const { container } = shell();
    expect(el(container, ".sts-build").textContent).toBe("Stagehand dev");
  });

  test("the rail's foot opens Stagehand's settings panel", async () => {
    const r = shell();
    fireEvent.click(r.getByRole("button", { name: "Stagehand settings" }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual({ kind: "open-settings" });
    });
  });
});
