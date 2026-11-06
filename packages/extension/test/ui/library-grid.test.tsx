// @vitest-environment happy-dom
import type { Snapshot, WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { ExtensionMessage, SetupState } from "../../src/messages.ts";
import { el, renderUi, sent, setupState } from "./harness.tsx";

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
  fireEvent.click(r.getByRole("tab", { name: "By world" }));
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
