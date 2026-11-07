// @vitest-environment happy-dom
import type { Snapshot, WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { ExtensionMessage, SetupState } from "../../src/messages.ts";
import { el, pkg, renderUi, sent, setupState } from "./harness.tsx";

afterEach(cleanup);

const snap = (worldId: string, active: string[]): Snapshot => ({
  worldId,
  title: worldId,
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
});
const world = (id: string, title: string, over: Partial<WorldInfo> = {}) => ({
  id,
  title,
  system: "dnd5e",
  systemVersion: "5",
  coreVersion: "14.369",
  ...over,
});

function grid(over: Partial<SetupState> = {}) {
  const base = setupState();
  const data: Partial<SetupState> = {
    setup: base.setup
      ? {
          ...base.setup,
          worlds: [
            world("w1", "Strahd", { favorite: true }),
            world("w2", "Vaults"),
            world("w3", "Untracked"),
          ],
        }
      : undefined,
    snapshots: {
      w1: snap("w1", ["module-library", "a"]),
      w2: snap("w2", ["module-library"]),
    },
    ...over,
  };
  const full = setupState(data);
  const reply = (m: ExtensionMessage): unknown =>
    m.kind === "get-state" ? full : { queued: "n" };
  const r = renderUi("shell", {
    data,
    reply,
    state: { route: { kind: "library" } },
  });
  fireEvent.click(r.getByRole("tab", { name: /^By world/ }));
  return r;
}

const heads = (c: ParentNode): string[] =>
  [...c.querySelectorAll(".mll-grid thead th.w .t")].map((n) => n.textContent);

describe("the By world grid", () => {
  test("a column per world in Foundry's order, a row per module", () => {
    const { container } = grid();
    expect(heads(container)).toEqual(["Strahd", "Untracked", "Vaults"]);
    expect(
      container.querySelectorAll('.mll-grid tbody tr[data-module="a"]'),
    ).toHaveLength(1);
  });

  test("each cell is a switch that queues for that world's next launch", async () => {
    const { container, send } = grid();
    const row = el(container, '.mll-grid tbody tr[data-module="a"]');
    const sw = within(row).getByRole<HTMLInputElement>("switch", {
      name: "Title a on in Vaults",
    });
    expect(sw.checked).toBe(false);
    expect(
      within(row).getByRole<HTMLInputElement>("switch", {
        name: "Title a on in Strahd",
      }).checked,
    ).toBe(true);
    fireEvent.click(sw);
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w2",
        mode: "add",
        presetIds: [],
        modules: ["a"],
      });
    });
  });

  test("a world without the companion shows dashes, not switches", () => {
    const { container } = grid();
    const row = el(container, '.mll-grid tbody tr[data-module="a"]');
    expect(within(row).queryByRole("switch", { name: /Untracked/ })).toBe(null);
    expect(row.textContent).toContain("–");
    const head = [...container.querySelectorAll(".mll-grid thead th.w")].find(
      (th) => th.textContent.includes("Untracked"),
    );
    expect(head?.textContent).toContain("companion off");
  });

  test("group rows fold like every group header: arrow first", () => {
    const { container } = grid();
    const head = el(container, ".mll-grid tr.grp button");
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(head.querySelector(".fa-chevron-down")).toBeTruthy();
    const before = container.querySelectorAll(
      ".mll-grid tbody tr[data-module]",
    ).length;
    fireEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelectorAll(".mll-grid tbody tr[data-module]").length,
    ).toBeLessThan(before);
  });

  test("Show favourites; hidden worlds with changes are named", () => {
    const { container, getByRole } = grid({
      commands: [
        {
          id: "c1",
          scope: "world",
          worldId: "w2",
          type: "preset.apply",
          payload: { mode: "add", presetIds: [], modules: ["b"] },
          createdAt: "t",
          baseSnapshotAt: null,
          status: "pending",
        },
      ],
    });
    fireEvent.change(getByRole("combobox", { name: "Show" }), {
      target: { value: "fav" },
    });
    expect(heads(container)).toEqual(["Strahd"]);
    expect(el(container, ".mll-showing").textContent).toContain(
      "1 of 3 worlds",
    );
    fireEvent.click(
      getByRole("button", { name: /1 hidden world with changes/ }),
    );
    expect(heads(container)).toHaveLength(3);
  });

  test("world columns keep a set width; the table ends after the last (polish)", () => {
    const { container, getByRole } = grid();
    const table = el(container, ".mll-grid");
    // 250 px for the module names, 92 px per world: never stretched.
    expect(table.style.width).toBe(`${String(250 + 3 * 92)}px`);
    fireEvent.change(getByRole("combobox", { name: "Show" }), {
      target: { value: "fav" },
    });
    expect(el(container, ".mll-grid").style.width).toBe(
      `${String(250 + 92)}px`,
    );
  });

  test("nothing to show offers to show all", () => {
    const { container, getByRole } = grid();
    fireEvent.change(getByRole("combobox", { name: "Show" }), {
      target: { value: "recent" },
    });
    expect(heads(container)).toEqual([]);
    fireEvent.click(getByRole("button", { name: "Show all 3 worlds" }));
    expect(heads(container)).toHaveLength(3);
  });

  test("a world's name opens its page", () => {
    const { getByRole, store } = grid();
    fireEvent.click(getByRole("button", { name: "Open Vaults" }));
    expect(store.get().route).toEqual({ kind: "world", worldId: "w2" });
  });
});

describe("the grid's extras (6c2)", () => {
  test("a group row shows each world's count; a click turns them all on there", async () => {
    const r = grid();
    const [count] = r.getAllByRole("button", {
      name: /Turn all on in Vaults$/,
    });
    if (!count) throw new Error("no count");
    expect(count.textContent).toMatch(/^\d+\/\d+$/);
    fireEvent.click(count);
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual(
        expect.objectContaining({
          kind: "queue-apply",
          worldId: "w2",
          mode: "add",
        }),
      );
    });
  });

  test("a module's name opens its details; its tags show as dots", () => {
    const r = grid();
    const row = el(r.container, '.mll-grid tr[data-module="a"]');
    expect(row.querySelectorAll(".dots .ml-dot")).toHaveLength(1);
    fireEvent.click(within(row).getByRole("button", { name: "Title a" }));
    expect(r.store.get().panel).toBe("a");
  });

  test("a world's menu: Open, Copy this set to… another world, Discard", async () => {
    const r = grid();
    fireEvent.click(r.getByRole("button", { name: "Strahd: actions" }));
    fireEvent.click(r.getByRole("button", { name: "Copy this set to…" }));
    fireEvent.click(r.getByRole("button", { name: "Vaults" }));
    fireEvent.click(r.getByRole("button", { name: "Add Strahd's modules" }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual(
        expect.objectContaining({
          kind: "queue-apply",
          worldId: "w2",
          mode: "add",
          modules: ["a"],
        }),
      );
    });
    fireEvent.click(r.getByRole("button", { name: "Strahd: actions" }));
    fireEvent.click(r.getByRole("button", { name: "Open world" }));
    expect(r.store.get().route).toEqual({ kind: "world", worldId: "w1" });
  });

  test("a world's menu takes focus to its first item, on each step (Phase 6)", async () => {
    const r = grid();
    fireEvent.click(r.getByRole("button", { name: "Strahd: actions" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        r.getByRole("button", { name: "Open world" }),
      ),
    );
    fireEvent.click(r.getByRole("button", { name: "Copy this set to…" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        r.getByRole("button", { name: "Vaults" }),
      ),
    );
  });

  test("the legend explains the colours; the filter narrows the modules", () => {
    const r = grid();
    expect(el(r.container, ".mls-gridlegend").textContent).toContain(
      "turns on at the next launch",
    );
    fireEvent.input(r.getByRole("searchbox", { name: "Filter modules" }), {
      target: { value: "module-lib" },
    });
    const rows = [
      ...r.container.querySelectorAll(".mll-grid tbody tr[data-module]"),
    ];
    expect(new Set(rows.map((x) => x.getAttribute("data-module")))).toEqual(
      new Set(["module-library"]),
    );
  });
});

describe("group counts (package 6 review)", () => {
  test("nothing can turn on: the count says so and is off", () => {
    const base = setupState();
    const r = grid({
      setup: base.setup && {
        ...base.setup,
        worlds: [world("w2", "Vaults")],
        modules: [
          base.setup.modules.find((m) => m.id === "module-library")!,
          pkg("needy", { requires: [{ id: "missing", type: "module" }] }),
        ],
      },
      snapshots: { w2: snap("w2", ["module-library"]) },
    });
    const [count] = r
      .getAllByRole("button", { name: /Vaults/ })
      .filter((b) => b.classList.contains("mls-gcount"));
    expect((count as HTMLButtonElement).disabled).toBe(true);
    expect(count?.getAttribute("title")).toMatch(/can't/);
  });

  test("a double click queues the group once", async () => {
    const r = grid();
    const [count] = r.getAllByRole("button", {
      name: /Turn all on in Vaults$/,
    });
    if (!count) throw new Error("no count");
    fireEvent.click(count);
    fireEvent.click(count);
    await waitFor(() => {
      expect(
        sent(r.send).filter(
          (m) => (m as { kind?: string }).kind === "queue-apply",
        ).length,
      ).toBe(1);
    });
  });
});

describe("a change made outside the world's page that breaks it (Phase 6)", () => {
  test("says so: the world now has problems, open it to fix", async () => {
    const base = setupState();
    const before: Partial<SetupState> = {
      setup: base.setup
        ? { ...base.setup, worlds: [world("w1", "Strahd")] }
        : undefined,
      snapshots: { w1: snap("w1", ["module-library", "c", "lib"]) },
    };
    let queued = false;
    const r = renderUi("shell", {
      data: before,
      state: { route: { kind: "library" } },
      reply: (m) => {
        if (m.kind === "queue-apply") {
          queued = true;
          return { queued: "n" };
        }
        if (m.kind !== "get-state") return undefined;
        return setupState({
          ...before,
          commands: queued
            ? [
                {
                  id: "n",
                  scope: "world",
                  worldId: "w1",
                  type: "preset.apply",
                  payload: { mode: "remove", presetIds: [], modules: ["lib"] },
                  createdAt: "2026-11-05T01:00:00.000Z",
                  baseSnapshotAt: null,
                  status: "pending",
                },
              ]
            : [],
        });
      },
    });
    fireEvent.click(r.getByRole("tab", { name: /^By world/ }));
    fireEvent.click(r.getByRole("switch", { name: "Title lib on in Strahd" }));
    await waitFor(() =>
      expect(r.page.notify).toHaveBeenCalledWith(
        "warning",
        "Strahd now has 2 modules that need attention. Open it to fix.",
      ),
    );
  });
});
