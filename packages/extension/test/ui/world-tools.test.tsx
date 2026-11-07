// @vitest-environment happy-dom
// The world page as the prototype: tabs with icons and counts, the tools in
// the tab row, a group's "Turn all on / off", View options, and the launch
// review's extras.
import type { Command, Snapshot } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { screen } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { ExtensionMessage, SetupState } from "../../src/messages.ts";
import type { BackupInfo } from "../../src/page-backups.ts";
import { inParts } from "../../src/ui/shell/world/turn-all.ts";
import { el, pkg, renderUi, sent, setupState } from "./harness.tsx";

afterEach(cleanup);

const snap = (active: string[]): Snapshot => ({
  worldId: "w1",
  title: "w1",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
});

const cmd = (id: string, modules: string[]): Command => ({
  id,
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: [], modules },
  createdAt: "2026-11-05T01:00:00.000Z",
  baseSnapshotAt: null,
  status: "pending",
});

const DAY = 24 * 60 * 60 * 1000;
const BACKUPS: BackupInfo[] = [
  {
    id: "b1",
    createdAt: Date.now() - 3 * DAY,
    size: 441 * 1024 * 1024,
    snapshot: false,
  },
  { id: "b2", createdAt: Date.now() - 9 * DAY, size: 1024, snapshot: false },
];

function page(over: Partial<SetupState> = {}, backups = BACKUPS) {
  const data: Partial<SetupState> = {
    snapshots: { w1: snap(["module-library", "a"]) },
    ...over,
  };
  const r = renderUi("shell", {
    data,
    // As the background answers: the state for get-state.
    reply: (m: ExtensionMessage) =>
      m.kind === "queue-apply"
        ? { queued: "n" }
        : m.kind === "get-state"
          ? setupState(data)
          : undefined,
    state: { route: { kind: "world", worldId: "w1" } },
    backups,
  });
  return r;
}

const tabs = (c: ParentNode): string[] =>
  [...c.querySelectorAll(".mls-subtabs [role=tab]")].map((b) =>
    b.textContent.replace(/\s+/g, " ").trim(),
  );

describe("the world page's tab row", () => {
  test("tabs have icons and counts: modules on, and Foundry's backups", async () => {
    const { container } = page();
    await waitFor(() => {
      expect(tabs(container)).toEqual(["Modules 2 on", "About", "Backups 2"]);
    });
    expect(container.querySelectorAll(".mls-subtabs [role=tab] i").length).toBe(
      3,
    );
  });

  test("with changes queued, Modules counts what is on after the launch", async () => {
    const { container } = page({ commands: [cmd("c1", ["b"])] });
    await waitFor(() => {
      expect(tabs(container)[0]).toBe("Modules 3 after launch");
    });
  });

  test("the filter, All / On / Changes, Add and View options sit in the tab row", () => {
    const { container } = page();
    const row = el(container, ".mls-subtabs");
    expect(row.querySelector('input[type="search"]')).toBeTruthy();
    expect(within(row).getByRole("button", { name: /^All/ })).toBeTruthy();
    expect(within(row).getByRole("button", { name: /^Add/ })).toBeTruthy();
    expect(
      within(row).getByRole("button", { name: "View options" }),
    ).toBeTruthy();
  });
});

describe("a group's actions", () => {
  test("Turn all on queues the group's modules that are off, in one change", async () => {
    const { container, getByRole, send } = page();
    // Unfiled holds b, c and lib (off) and the companion (on).
    const unfiled = [...container.querySelectorAll<HTMLElement>(".mlw-sec")].at(
      -1,
    );
    if (!unfiled) throw new Error("no unfiled group");
    fireEvent.click(within(unfiled).getByRole("button", { name: /actions$/ }));
    fireEvent.click(getByRole("button", { name: "Turn all on" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w1",
        mode: "add",
        presetIds: [],
        modules: ["b", "c", "lib"],
      });
    });
  });

  test("Turn all off leaves the companion on", async () => {
    const { container, getByRole, send } = page({
      snapshots: { w1: snap(["module-library", "a", "lib"]) },
    });
    const unfiled = [...container.querySelectorAll(".mlw-sec")].at(-1);
    if (!unfiled) throw new Error("no unfiled group");
    fireEvent.click(
      within(unfiled as HTMLElement).getByRole("button", { name: /actions$/ }),
    );
    fireEvent.click(getByRole("button", { name: "Turn all off" }));
    await waitFor(() => {
      const off = sent(send).find(
        (m) => (m as { mode?: string }).mode === "remove",
      ) as { modules?: string[] } | undefined;
      expect(off?.modules).toEqual(["lib"]);
    });
  });
});

describe("review fixes (package 3)", () => {
  test("Turn all on leaves out a module that can't turn on (blocked)", async () => {
    const base = setupState();
    const { container, getByRole, send } = page({
      setup: base.setup && {
        ...base.setup,
        modules: [
          ...base.setup.modules,
          pkg("d", { requires: [{ id: "gone", type: "module" }] }),
        ],
      },
    });
    const unfiled = [...container.querySelectorAll<HTMLElement>(".mlw-sec")].at(
      -1,
    );
    if (!unfiled) throw new Error("no unfiled group");
    fireEvent.click(within(unfiled).getByRole("button", { name: /actions$/ }));
    fireEvent.click(getByRole("button", { name: "Turn all on" }));
    await waitFor(() => {
      const add = sent(send).find(
        (m) => (m as { mode?: string }).mode === "add",
      ) as { modules?: string[] } | undefined;
      expect(add?.modules).toEqual(["b", "c", "lib"]);
    });
  });

  test("a big group is queued in parts the background accepts", () => {
    const ids = Array.from({ length: 1201 }, (_, i) => `m${String(i)}`);
    const parts = inParts(ids);
    expect(parts.map((p) => p.length)).toEqual([500, 500, 201]);
    expect(parts.flat()).toEqual(ids);
  });

  test("View options closes when focus leaves it", () => {
    const { getByRole, queryByRole } = page();
    fireEvent.click(getByRole("button", { name: "View options" }));
    const pop = getByRole("region", { name: "View options" });
    fireEvent.focusOut(pop, { relatedTarget: document.body });
    expect(queryByRole("region", { name: "View options" })).toBe(null);
  });

  test("the details close when their module goes", async () => {
    const r = page();
    fireEvent.click(r.getByRole("button", { name: "Title a" }));
    expect(r.store.get().panel).toBe("a");
    r.store.set({ route: { kind: "library" } });
    expect(r.store.get().panel).toBe("a");
    const s = r.store.get().data.setup;
    r.store.set((st) => ({
      data: {
        ...st.data,
        setup: s && { ...s, modules: s.modules.filter((m) => m.id !== "a") },
      },
    }));
    await waitFor(() => {
      expect(r.store.get().panel).toBe(null);
    });
  });
});

describe("View options", () => {
  test("Group by tag regroups the cards", () => {
    const { container, getByRole } = page();
    fireEvent.click(getByRole("button", { name: "View options" }));
    fireEvent.change(getByRole("combobox", { name: "Group by" }), {
      target: { value: "tag" },
    });
    const names = [...container.querySelectorAll(".mlw-sec .name")].map(
      (n) => n.textContent,
    );
    expect(names).toContain("visual");
  });

  test("List shows one line per module", () => {
    const { container, getByRole } = page();
    fireEvent.click(getByRole("button", { name: "View options" }));
    fireEvent.click(getByRole("button", { name: "List" }));
    expect(container.querySelector(".mlc-row")).toBeTruthy();
    expect(container.querySelector(".mlw-card")).toBe(null);
  });
});

describe("the launch review's extras", () => {
  test("a change can be dropped from the review", async () => {
    const { getByRole, send } = page({ commands: [cmd("c1", ["b"])] });
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    const dialog = await screen.findByRole("dialog", { name: "Launch Strahd" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Drop Title b" }),
    );
    await waitFor(() => {
      expect(sent(send)).toContainEqual({ kind: "cancel-command", id: "c1" });
    });
  });

  test("Back up first says how big and how old the latest backup is", async () => {
    const { getByRole } = page({ commands: [cmd("c1", ["b"])] });
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    const dialog = await screen.findByRole("dialog", { name: "Launch Strahd" });
    await waitFor(() => {
      expect(dialog.textContent).toContain("About 441 MB");
    });
    expect(dialog.textContent).toContain(
      "The latest backup is from 3 days ago",
    );
  });
});
