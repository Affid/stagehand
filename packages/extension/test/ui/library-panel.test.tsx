// @vitest-environment happy-dom
import type { Snapshot } from "@stagehand/shared/world";
import {
  act,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/preact";
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

function open(over: Partial<SetupState> = {}) {
  const data: Partial<SetupState> = {
    snapshots: { w1: snap("w1", ["stagehand", "a"]) },
    ...over,
  };
  const full = setupState(data);
  const reply = (m: ExtensionMessage): unknown =>
    m.kind === "get-state"
      ? full
      : m.kind === "queue-apply"
        ? { queued: "n" }
        : { ok: true, library: full.library };
  const r = renderUi("shell", {
    data,
    reply,
    state: { route: { kind: "library" } },
  });
  fireEvent.click(r.getByRole("button", { name: "Title a" }));
  const panel = r.getByRole("complementary", { name: "Title a" });
  return { ...r, panel };
}

describe("a module's details", () => {
  test("open from the card's name; Close puts the panel away", () => {
    const { panel, getByRole, queryByRole } = open();
    expect(within(panel).getByRole("heading", { name: "Title a" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
    expect(queryByRole("complementary", { name: "Title a" })).toBe(null);
    expect(getByRole("button", { name: "Title a" })).toBeTruthy();
  });

  test("the folder can be changed", async () => {
    const { panel, send } = open();
    fireEvent.change(within(panel).getByRole("combobox", { name: "Folder" }), {
      target: { value: "" },
    });
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: { op: "module.setFolder", moduleIds: ["a"], folderId: null },
      });
    });
  });

  test("tags are removed and added", async () => {
    const { panel, send } = open({
      library: {
        ...setupState().library,
        tags: [
          { id: "t1", name: "visual", color: "#3c8dc9", revision: 1 },
          { id: "t2", name: "audio", color: "#5aa469", revision: 1 },
        ],
      },
    });
    fireEvent.click(
      within(panel).getByRole("button", { name: "Remove tag visual" }),
    );
    fireEvent.change(within(panel).getByRole("combobox", { name: "Add tag" }), {
      target: { value: "t2" },
    });
    await waitFor(() => {
      expect(sent(send)).toEqual(
        expect.arrayContaining([
          {
            kind: "library-op",
            op: {
              op: "module.setTags",
              moduleIds: ["a"],
              add: [],
              remove: ["t1"],
            },
          },
          {
            kind: "library-op",
            op: {
              op: "module.setTags",
              moduleIds: ["a"],
              add: ["t2"],
              remove: [],
            },
          },
        ]),
      );
    });
  });

  test("the note saves when it loses focus", async () => {
    const { panel, send } = open();
    const note = within(panel).getByRole("textbox", { name: "Note" });
    expect((note as HTMLTextAreaElement).value).toBe("for Strahd");
    note.focus();
    fireEvent.input(note, { target: { value: "for Strahd and Vaults" } });
    // Leave the field as a person does: real focus, then blur.
    note.blur();
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: {
          op: "module.setNote",
          moduleId: "a",
          note: "for Strahd and Vaults",
        },
      });
    });
  });

  test("presets that hold it are listed as chips", () => {
    const { panel } = open();
    expect(el(panel, ".stl-chip.preset").textContent).toContain("QoL");
  });

  test("its own column beside the page, headed id · version · authors", () => {
    const { panel, container } = open();
    expect(panel.parentElement).toBe(el(container, ".sts"));
    expect(panel.classList.contains("sts-panel")).toBe(true);
    expect(el(panel, ".sts-modhead .sub").textContent).toBe("a · v1.0.0 · Ann");
  });

  test("every world is listed; one without the companion says so", () => {
    const base = setupState();
    const { panel } = open({
      setup: base.setup && {
        ...base.setup,
        worlds: [
          ...base.setup.worlds,
          {
            id: "w2",
            title: "Vaults",
            system: "dnd5e",
            systemVersion: "5",
            coreVersion: "14.369",
          },
        ],
      },
    });
    expect(panel.textContent).toContain("On in worlds · 1 of 2");
    const vaults = [...panel.querySelectorAll(".sts-wlist li")].find((li) =>
      li.textContent.includes("Vaults"),
    );
    expect(vaults?.textContent).toContain("companion off");
    expect(vaults?.querySelector("input")?.disabled).toBe(true);
  });

  test("each tracked world has a switch that queues for its next launch", async () => {
    const { panel, send } = open();
    const sw = within(panel).getByRole<HTMLInputElement>("switch", {
      name: "Title a on in Strahd",
    });
    expect(sw.checked).toBe(true);
    fireEvent.click(sw);
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w1",
        mode: "remove",
        presetIds: [],
        modules: ["a"],
      });
    });
  });

  test("the Package tab: version with Foundry's badge, needs, authors and links", () => {
    const { panel } = open();
    fireEvent.click(within(panel).getByRole("tab", { name: "Package" }));
    const text = el(panel, ".sts-pkgtab .sts-kv").textContent;
    expect(text).toContain("1.0.0");
    expect(text).toContain("verified for 14");
    expect(text).toContain("Foundry 13 or newer");
    expect(text).toContain("Ann");
    expect(el(panel, ".sts-pkgtab").textContent).toContain(
      "No compendium packs",
    );
  });

  test("the note follows a change made elsewhere", () => {
    const { panel, store } = open();
    void act(() => {
      store.set((s) => ({
        data: {
          ...s.data,
          library: {
            ...s.data.library,
            modules: {
              ...s.data.library.modules,
              a: { folderId: "f1", tags: ["t1"], note: "imported note" },
            },
          },
        },
      }));
    });
    expect(
      within(panel).getByRole<HTMLTextAreaElement>("textbox", {
        name: "Note",
      }).value,
    ).toBe("imported note");
  });

  test("the companion can't be switched off from here", () => {
    const r = renderUi("shell", {
      data: { snapshots: { w1: snap("w1", ["stagehand", "a"]) } },
      state: { route: { kind: "library" } },
    });
    fireEvent.click(r.getByRole("button", { name: "Title stagehand" }));
    const panel = r.getByRole("complementary", {
      name: "Title stagehand",
    });
    expect(
      within(panel).getByRole<HTMLInputElement>("switch", {
        name: /on in Strahd/,
      }).disabled,
    ).toBe(true);
  });
});

describe("the Package tab's server settings and actions (6b2)", () => {
  test("relationships say what is installed", () => {
    const base = setupState();
    const { panel } = open({
      setup: base.setup && {
        ...base.setup,
        modules: base.setup.modules.map((m) =>
          m.id === "a"
            ? {
                ...m,
                requires: [{ id: "lib", type: "module" }],
                conflicts: [{ id: "gone", type: "module" }],
                packs: ["Macros"],
                languages: ["English"],
              }
            : m,
        ),
      },
    });
    fireEvent.click(within(panel).getByRole("tab", { name: "Package" }));
    const rel = el(panel, ".sts-pkgtab").textContent;
    expect(rel).toContain("Needs Title libinstalled");
    expect(rel).toContain("Conflicts with gonenot installed");
    expect(rel).toContain("1 compendium pack: Macros");
    expect(rel).toContain("English");
  });

  test("Favourite and Lock updates are Foundry's own; the buttons open its dialogs", () => {
    const { panel, page } = open();
    fireEvent.click(within(panel).getByRole("tab", { name: "Package" }));
    fireEvent.click(within(panel).getByRole("switch", { name: "Favourite" }));
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "favoritePackage",
      packageType: "module",
      id: "a",
    });
    fireEvent.click(
      within(panel).getByRole("switch", { name: "Lock updates" }),
    );
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "lockPackage",
      packageType: "module",
      id: "a",
    });
    for (const [name, action] of [
      ["Edit manifest…", "editPackage"],
      ["Update if available", "updatePackage"],
      ["Backup", "backupPackage"],
      ["Uninstall", "uninstallPackage"],
    ] as const) {
      fireEvent.click(within(panel).getByRole("button", { name }));
      expect(page.foundryAction).toHaveBeenCalledWith({
        action,
        packageType: "module",
        id: "a",
      });
    }
  });
});
