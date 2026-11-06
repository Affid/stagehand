// @vitest-environment happy-dom
// The Library's head and toolbar as the prototype (6a): tabs with counts,
// Foundry's Install and Update All, Group by, Select with its bar, Collapse
// all, New folder, the Tags and Presets panels, and Import and export.
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Snapshot } from "@module-library/shared/world";
import type { SetupState } from "../../src/messages.ts";
import { el, renderUi, sent } from "./harness.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const snap: Snapshot = {
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: ["module-library", "a"].map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
};

const library = (data: Partial<SetupState> = {}) =>
  renderUi("shell", {
    data: { snapshots: { w1: snap }, ...data },
    state: { route: { kind: "library" } },
  });

const opSent = (r: ReturnType<typeof library>, op: object) =>
  waitFor(() => {
    expect(sent(r.send)).toContainEqual({
      kind: "library-op",
      op: expect.objectContaining(op) as unknown,
    });
  });

describe("the Library's head", () => {
  test("tabs Modules, Systems and By world, with icons and counts", () => {
    const { container } = library();
    const tabs = [...container.querySelectorAll(".mll-page [role=tab]")].map(
      (x) => x.textContent,
    );
    expect(tabs).toEqual(["Modules 5", "Systems 1", "By world 1"]);
  });

  test("Install Module and Update All are Foundry's own", () => {
    const { getByRole, page } = library();
    fireEvent.click(getByRole("button", { name: "Install Module" }));
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "installPackage",
      packageType: "module",
    });
    fireEvent.click(getByRole("button", { name: "Update All" }));
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "updateAll",
      packageType: "module",
    });
  });

  test("the Systems tab lists systems, with Install System", () => {
    const { container, getByRole, page } = library();
    fireEvent.click(getByRole("tab", { name: /^Systems/ }));
    expect(el(container, '[data-system="dnd5e"]').textContent).toContain(
      "used by 1 world",
    );
    fireEvent.click(getByRole("button", { name: "Install System" }));
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "installPackage",
      packageType: "system",
    });
  });

  test("no Organise and no Cards / Foundry's switch", () => {
    const { queryByRole } = library();
    expect(queryByRole("button", { name: "Organise" })).toBe(null);
    expect(queryByRole("button", { name: "Foundry's" })).toBe(null);
  });
});

describe("the toolbar", () => {
  test("Collapse all folds every group; again opens them", () => {
    const { container, getByRole } = library();
    fireEvent.click(getByRole("button", { name: "Collapse all" }));
    const heads = [...container.querySelectorAll(".mll-sec .mlw-head")];
    expect(
      heads.every((h) => h.getAttribute("aria-expanded") === "false"),
    ).toBe(true);
    fireEvent.click(getByRole("button", { name: "Expand all" }));
    expect(heads.every((h) => h.getAttribute("aria-expanded") === "true")).toBe(
      true,
    );
  });

  test("New folder creates one and names it in place", async () => {
    const r = library();
    fireEvent.click(r.getByRole("button", { name: "New folder" }));
    await opSent(r, { op: "folder.create" });
  });

  test("Import and export offers the library and a preset file", () => {
    const { getByRole } = library();
    fireEvent.click(getByRole("button", { name: "Import and export" }));
    const pop = getByRole("region", { name: "Import and export" });
    expect(
      within(pop)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Export the library", "Import a library…", "Import a preset…"]);
  });
});

describe("the Tags and Presets panels", () => {
  test("Tags lists each tag with its count; New tag; rename; tag a module; Delete tag", async () => {
    const r = library();
    fireEvent.click(r.getByRole("button", { name: "Tags" }));
    const p = r.getByRole("complementary", { name: "Tags" });
    expect(el(p, ".mls-list").textContent).toContain("visual1");
    const name = within(p).getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "looks" } });
    await opSent(r, { op: "tag.update", changes: { name: "looks" } });
    fireEvent.click(within(p).getByRole("checkbox", { name: "Title b" }));
    await opSent(r, { op: "module.setTags", moduleIds: ["b"], add: ["t1"] });
    vi.stubGlobal("confirm", () => true);
    fireEvent.click(within(p).getByRole("button", { name: "Delete tag" }));
    await opSent(r, { op: "tag.delete", id: "t1" });
    fireEvent.click(within(p).getByRole("button", { name: "New tag" }));
    await opSent(r, { op: "tag.create" });
  });

  test("Presets: name, about, modules, Add to a world… and Delete preset", async () => {
    const r = library();
    fireEvent.click(r.getByRole("button", { name: "Presets" }));
    const p = r.getByRole("complementary", { name: "Presets" });
    fireEvent.change(within(p).getByRole("textbox", { name: "About" }), {
      target: { value: "Quality of life" },
    });
    await opSent(r, {
      op: "preset.update",
      changes: { description: "Quality of life" },
    });
    fireEvent.click(within(p).getByRole("button", { name: "Add to a world…" }));
    fireEvent.click(within(p).getByRole("button", { name: /Strahd/ }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual(
        expect.objectContaining({
          kind: "queue-apply",
          worldId: "w1",
          presetIds: ["p1"],
        }),
      );
    });
    vi.stubGlobal("confirm", () => true);
    fireEvent.click(within(p).getByRole("button", { name: "Delete preset" }));
    await opSent(r, { op: "preset.delete", id: "p1" });
  });

  test("a module's details replace the panel; the panels show only on the Library", async () => {
    const r = library();
    fireEvent.click(r.getByRole("button", { name: "Tags" }));
    expect(r.store.get().side).toEqual({ kind: "tags" });
    r.store.set({ route: { kind: "world", worldId: "w1" } });
    await waitFor(() => {
      expect(r.queryByRole("complementary", { name: "Tags" })).toBe(null);
    });
  });
});

describe("the selection's bar", () => {
  test("Select: count, All shown, None, Move to, Add to preset, Turn on in a world…", async () => {
    const r = library();
    fireEvent.click(r.getByRole("button", { name: "Select" }));
    const bar = el(r.container, ".mls-selbar");
    expect(bar.textContent).toContain("None selected");
    fireEvent.click(within(bar).getByRole("button", { name: "All shown" }));
    expect(r.store.get().selection.length).toBe(5);
    fireEvent.click(within(bar).getByRole("button", { name: "None" }));
    fireEvent.click(
      within(el(r.container, '.mll-card[data-module="b"]')).getByRole(
        "checkbox",
      ),
    );
    fireEvent.click(within(bar).getByRole("button", { name: "Move to" }));
    fireEvent.click(within(bar).getByRole("button", { name: /Combat/ }));
    await opSent(r, {
      op: "module.setFolder",
      moduleIds: ["b"],
      folderId: "f1",
    });
    fireEvent.click(within(bar).getByRole("button", { name: "Add to preset" }));
    fireEvent.click(within(bar).getByRole("button", { name: /QoL/ }));
    await opSent(r, { op: "preset.update", id: "p1" });
    fireEvent.click(
      within(bar).getByRole("button", { name: "Turn on in a world…" }),
    );
    fireEvent.click(within(bar).getByRole("button", { name: /Strahd/ }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual(
        expect.objectContaining({
          kind: "queue-apply",
          worldId: "w1",
          modules: ["b"],
        }),
      );
    });
  });

  test("Tags for the selection: a click cycles all and none; Apply sends both", async () => {
    const r = library();
    fireEvent.click(r.getByRole("button", { name: "Select" }));
    const bar = el(r.container, ".mls-selbar");
    for (const id of ["a", "b"])
      fireEvent.click(
        within(el(r.container, `.mll-card[data-module="${id}"]`)).getByRole(
          "checkbox",
        ),
      );
    fireEvent.click(within(bar).getByRole("button", { name: "Tags" }));
    const box = within(bar).getByRole("checkbox", { name: /visual/ });
    expect(box.closest("label")?.textContent).toContain("1 of 2");
    fireEvent.click(box);
    fireEvent.click(within(bar).getByRole("button", { name: "Apply" }));
    await opSent(r, {
      op: "module.setTags",
      moduleIds: ["a", "b"],
      add: ["t1"],
      remove: [],
    });
  });
});
