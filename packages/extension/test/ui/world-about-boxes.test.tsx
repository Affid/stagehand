// @vitest-environment happy-dom
// The About tab as the prototype: Details with Rename and Change, Background,
// Maintenance (data, safe mode, reset passwords, lock) and the Danger zone.
import type { WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { BackupInfo } from "../../src/page-backups.ts";
import { el, renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

const BACKUPS: BackupInfo[] = [
  { id: "b1", createdAt: Date.now(), size: 441 * 1024 * 1024, snapshot: false },
];

function about(over: Partial<WorldInfo> = {}) {
  const base = setupState();
  const world: WorldInfo = {
    id: "w1",
    title: "Strahd",
    system: "dnd5e",
    systemVersion: "5.1",
    coreVersion: "14.369",
    verified: "14.369",
    playtime: 61 * 3600,
    ...over,
  };
  const r = renderUi("shell", {
    data: {
      setup: base.setup && {
        ...base.setup,
        core: { version: "14.370", generation: 14, build: 370 },
        systems: [
          ...base.setup.systems,
          { id: "pf2e", title: "Pathfinder Second Edition", version: "7.2" },
        ],
        worlds: [world],
      },
    },
    state: { route: { kind: "world", worldId: "w1" } },
    backups: BACKUPS,
  });
  fireEvent.click(r.getByRole("tab", { name: /^About/ }));
  return r;
}

const box = (c: ParentNode, title: string): HTMLElement => {
  const found = [
    ...c.querySelectorAll<HTMLElement>(".mlw-about .mlw-box"),
  ].find((b) => b.querySelector("h4")?.textContent.startsWith(title));
  if (!found) throw new Error(`no box ${title}`);
  return found;
};

describe("the About tab's boxes", () => {
  test("two columns: Description, Next session, Details; Background, Maintenance, Danger zone", () => {
    const { container } = about();
    const cols = [...container.querySelectorAll(".mlw-about > .col")].map(
      (col) =>
        [...col.querySelectorAll(".mlw-box > h4 > span:first-child")].map(
          (h) => h.textContent,
        ),
    );
    expect(cols).toEqual([
      ["Description", "Next session", "Details"],
      ["Background", "Maintenance", "Danger zone"],
    ]);
  });

  test("Details: made for, last saved with, played for, size and folder", async () => {
    const { container } = about({ coreVersion: "13.351" });
    const d = box(container, "Details");
    expect(d.textContent).toContain("Foundry 14 · checked with build 369");
    expect(d.textContent).toContain("Foundry 13.351");
    expect(d.textContent).toContain("older");
    expect(d.textContent).toContain("61 hours");
    expect(d.textContent).toContain("worlds/w1");
    await waitFor(() => {
      expect(d.textContent).toContain("about 441 MB");
    });
  });

  test("Rename saves the title through Foundry", async () => {
    const { container, page } = about();
    const d = box(container, "Details");
    fireEvent.click(within(d).getByRole("button", { name: "Rename" }));
    const input = within(d).getByRole("textbox", { name: "Title" });
    fireEvent.input(input, { target: { value: "Curse of Strahd" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        title: "Curse of Strahd",
      });
    });
  });

  test("Game system and Join screen change through Foundry, with a warning for the system", async () => {
    const { container, page } = about();
    const d = box(container, "Details");
    fireEvent.click(
      within(d).getByRole("button", { name: "Change game system" }),
    );
    expect(d.textContent).toContain(
      "Switching usually breaks actors and items",
    );
    fireEvent.change(within(d).getByRole("combobox", { name: "Game system" }), {
      target: { value: "pf2e" },
    });
    fireEvent.click(within(d).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", { system: "pf2e" });
    });
    fireEvent.click(
      within(d).getByRole("button", { name: "Change join screen" }),
    );
    fireEvent.change(within(d).getByRole("combobox", { name: "Join screen" }), {
      target: { value: "minimal" },
    });
    fireEvent.click(within(d).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        joinTheme: "minimal",
      });
    });
  });

  test("Description's Edit opens Foundry's own editor here, and Save saves its HTML", async () => {
    const { container, page } = about({ description: "<p>Gothic</p>" });
    const d = box(container, "Description");
    fireEvent.click(
      within(d).getByRole("button", { name: "Edit description" }),
    );
    const host = el(d, ".mlw-pmhost");
    expect(host.id).toMatch(/^ml-pm-/);
    expect(page.editorOpen).toHaveBeenCalledWith(host.id, "<p>Gothic</p>");
    fireEvent.click(within(d).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.editorSave).toHaveBeenCalledWith("w1", host.id);
    });
    await waitFor(() => {
      expect(d.querySelector(".mlw-pmhost")).toBe(null);
    });
    await waitFor(() => {
      expect(page.editorClose).toHaveBeenCalledWith(host.id);
    });
  });

  test("Background's Change opens Foundry's file picker", () => {
    const { container, page } = about({ background: "worlds/w1/bg.webp" });
    fireEvent.click(
      within(box(container, "Background")).getByRole("button", {
        name: "Change background",
      }),
    );
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "pickBackground",
      worldId: "w1",
    });
  });

  test("Maintenance: data status, safe mode, reset passwords after a confirm, lock", async () => {
    const { container, page } = about();
    const m = box(container, "Maintenance");
    expect(m.textContent).toContain("Up to date for Foundry 14");
    fireEvent.click(
      within(m).getByRole("switch", { name: "Safe mode for the next launch" }),
    );
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", { safeMode: true });
    });
    fireEvent.click(within(m).getByRole("button", { name: "Reset…" }));
    expect(m.textContent).toContain("Reset every player's password?");
    fireEvent.click(within(m).getByRole("button", { name: "Reset passwords" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", { resetKeys: true });
    });
    fireEvent.click(within(m).getByRole("switch", { name: "Lock this world" }));
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "lock",
      worldId: "w1",
    });
  });

  test("an older world says it migrates on the next launch", () => {
    const { container } = about({ coreVersion: "13.351" });
    expect(box(container, "Maintenance").textContent).toContain(
      "Migrates on the next launch",
    );
  });

  test("Danger zone: Delete goes to Foundry's own dialog", () => {
    const { container, page } = about();
    fireEvent.click(
      within(box(container, "Danger zone")).getByRole("button", {
        name: "Delete…",
      }),
    );
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "deleteWorld",
      worldId: "w1",
    });
  });

  test("a locked world: no edits, Delete and Launch say why they are off", () => {
    const { container, getByRole } = about({ locked: true });
    const d = box(container, "Details");
    expect(within(d).queryByRole("button", { name: "Rename" })).toBe(null);
    const del = within(
      box(container, "Danger zone"),
    ).getByRole<HTMLButtonElement>("button", { name: "Delete…" });
    expect(del.disabled).toBe(true);
    expect(del.parentElement?.getAttribute("title")).toContain(
      "unlock it first",
    );
    const launch = getByRole("button", {
      name: /^Launch/,
    }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
    expect(launch.parentElement?.getAttribute("title")).toContain("Locked");
    expect(el(container, ".mlw-about").textContent).toContain("Locked:");
  });
});
