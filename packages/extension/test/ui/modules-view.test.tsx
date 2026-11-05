// @vitest-environment happy-dom
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { el, renderUi, sent } from "./harness.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rows = (container: ParentNode): string[] =>
  [...container.querySelectorAll("li.ml-row")].map(
    (r) => r.getAttribute("data-module") ?? "",
  );

describe("modules view: list and filters", () => {
  test("groups modules by folder, unfiled last, with tags, notes and badges", () => {
    const { container, getByText } = renderUi("modules");
    const groups = [...container.querySelectorAll(".ml-group")];
    expect(
      groups.map(
        (g) =>
          g.querySelector(".ml-group-header > span:not(.ml-count):not(.ml-dot)")
            ?.textContent,
      ),
    ).toEqual(["Combat", "Unfiled"]);
    expect(getByText("for Strahd")).toBeTruthy();
    const b = el(container, 'li[data-module="b"]');
    expect(within(b).getByText("Not verified for 14.369")).toBeTruthy();
    const lib = el(container, 'li[data-module="lib"]');
    expect(within(lib).getByText("Library")).toBeTruthy();
  });

  test("search narrows the list and shows a count", () => {
    const { container, getByRole, getByText } = renderUi("modules");
    fireEvent.input(getByRole("searchbox"), { target: { value: "strahd" } });
    expect(rows(container)).toEqual(["a"]);
    expect(getByText("1 modules")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Clear filters" }));
    expect(rows(container)).toHaveLength(5);
  });

  test("tag chips filter, and AND/OR toggles with two tags", () => {
    const { container, getByRole, store } = renderUi("modules");
    fireEvent.click(getByRole("button", { name: "visual" }));
    expect(rows(container)).toEqual(["a"]);
    store.set((s) => ({ filter: { ...s.filter, tags: ["t1", "t2"] } }));
    return waitFor(() => {
      fireEvent.click(getByRole("button", { name: "All tags" }));
      expect(store.get().filter.tagOp).toBe("or");
    });
  });

  test("folders, smart groups and authors scope the list", async () => {
    const { container, getByText } = renderUi("modules");
    fireEvent.click(getByText("Libraries"));
    await waitFor(() => expect(rows(container)).toEqual(["lib"]));
    fireEvent.click(getByText("Not verified for this core version"));
    await waitFor(() => expect(rows(container)).toEqual(["b"]));
    fireEvent.click(el(container, 'button[data-folder="f1"]'));
    await waitFor(() => expect(rows(container)).toEqual(["a"]));
    fireEvent.click(getByText("All modules"));
    fireEvent.click(
      el(container, ".ml-sidebar [aria-label='Authors'] .ml-side-label"),
    );
    await waitFor(() => expect(rows(container)).toHaveLength(5));
  });

  test("the core list toggle hides the organised layout (S-8)", () => {
    const { container, getByRole, store } = renderUi("modules");
    fireEvent.click(getByRole("button", { name: "Core list" }));
    expect(store.get().view).toBe("core");
    expect(container.querySelector(".ml-layout")).toBeNull();
  });
});

describe("modules view: changes go to the background", () => {
  test("creating a folder sends folder.create", async () => {
    const { getByRole, send } = renderUi("modules");
    fireEvent.click(getByRole("button", { name: "+ New folder" }));
    const input = getByRole("textbox", { name: "Folder name" });
    fireEvent.input(input, { target: { value: "Lighting" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: {
          op: "folder.create",
          folder: expect.objectContaining({ name: "Lighting", parentId: null }),
        },
      }),
    );
  });

  test("bulk actions move, tag and start a preset from the selection", async () => {
    const { getByRole, send, store } = renderUi("modules");
    fireEvent.click(getByRole("checkbox", { name: "Select Title b" }));
    fireEvent.change(getByRole("combobox", { name: "Move to folder" }), {
      target: { value: "f1" },
    });
    fireEvent.change(getByRole("combobox", { name: "Add tag" }), {
      target: { value: "t1" },
    });
    fireEvent.change(getByRole("combobox", { name: "Remove tag" }), {
      target: { value: "t1" },
    });
    await waitFor(() => {
      const ops = sent(send).map((m) => (m as { op?: { op: string } }).op?.op);
      expect(ops).toEqual([
        "module.setFolder",
        "module.setTags",
        "module.setTags",
      ]);
    });
    fireEvent.click(getByRole("button", { name: "New preset from selection" }));
    expect(store.get()).toMatchObject({
      editingPreset: "new",
      draftModules: ["b"],
    });
    fireEvent.click(getByRole("button", { name: "Clear selection" }));
    expect(store.get().selection).toEqual([]);
  });

  test("editing a note sends module.setNote", async () => {
    const { container, send } = renderUi("modules");
    const row = el(container, 'li[data-module="b"]');
    fireEvent.click(within(row).getByRole("button", { name: "Add note" }));
    fireEvent.input(within(row).getByRole("textbox", { name: "Note" }), {
      target: { value: "check" },
    });
    fireEvent.click(within(row).getByRole("button", { name: "Save note" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: { op: "module.setNote", moduleId: "b", note: "check" },
      }),
    );
  });

  test("folder tools rename, recolour, reorder and delete with revisions", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const { getByRole, getByLabelText, send } = renderUi("modules");
    // The colour is chosen from swatches, not cycled.
    fireEvent.click(getByLabelText("Colour", { selector: "summary" }));
    fireEvent.click(getByRole("button", { name: "Teal" }));
    // The only folder can move neither up nor down.
    expect(getByRole("button", { name: "Move down" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(getByRole("button", { name: "Delete folder" }));
    fireEvent.click(getByRole("button", { name: "Rename" }));
    const input = getByRole("textbox", { name: "Folder name" });
    fireEvent.input(input, { target: { value: "Fights" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      const ops = sent(send).map(
        (m) => (m as { op: { op: string; baseRevision?: number } }).op,
      );
      expect(ops.map((o) => o.op)).toEqual([
        "folder.update",
        "folder.delete",
        "folder.update",
      ]);
      expect(ops.every((o) => o.baseRevision === 2)).toBe(true);
      expect(ops[0]).toMatchObject({ changes: { color: "#4cc9b0" } });
    });
  });

  test("a custom colour can be picked; the current one is not resent", async () => {
    const { getByRole, getByLabelText, send } = renderUi("modules");
    const picker = getByLabelText("Colour", { selector: "summary" });
    fireEvent.click(picker);
    const swatches = within(getByRole("group", { name: "Colour" }));
    const current = swatches.getByRole("button", { pressed: true });
    fireEvent.click(current);
    fireEvent.change(getByLabelText("Custom colour"), {
      target: { value: "#ABCDEF" },
    });
    await waitFor(() => {
      const ops = sent(send).map((m) => (m as { op: { changes?: object } }).op);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toMatchObject({ changes: { color: "#abcdef" } });
    });
  });

  test("the Unfiled group collapses too, without touching the library", () => {
    const { container, send } = renderUi("modules");
    const before = rows(container).length;
    const unfiled = el(container, '[data-folder-group=""] .ml-group-header');
    fireEvent.click(unfiled);
    expect(unfiled.getAttribute("aria-expanded")).toBe("false");
    expect(rows(container).length).toBeLessThan(before);
    fireEvent.click(unfiled);
    expect(rows(container)).toHaveLength(before);
    expect(sent(send)).toEqual([]);
  });

  test("collapsing a folder group is persisted (S-1)", async () => {
    const { container, send } = renderUi("modules");
    fireEvent.click(el(container, ".ml-group-header"));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: {
          op: "folder.update",
          id: "f1",
          baseRevision: 2,
          changes: { collapsed: true },
        },
      }),
    );
  });

  test("tags are created and deleted", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const { getByRole, send } = renderUi("modules");
    fireEvent.click(getByRole("button", { name: "+ New tag" }));
    const input = getByRole("textbox", { name: "Tag name" });
    fireEvent.input(input, { target: { value: "audio" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(getByRole("button", { name: "Delete tag" }));
    await waitFor(() => {
      const ops = sent(send).map((m) => (m as { op: { op: string } }).op.op);
      expect(ops).toEqual(["tag.create", "tag.delete"]);
    });
  });
});

describe("modules view: read-only and safe mode", () => {
  test("an unverified browser sees a banner and no tools (PR-2)", () => {
    const { queryByRole, getByText } = renderUi("modules", {
      data: { adminVerified: false },
    });
    expect(getByText(/Read-only/)).toBeTruthy();
    expect(queryByRole("button", { name: "+ New folder" })).toBeNull();
    expect(queryByRole("button", { name: "Add note" })).toBeNull();
  });

  test("safe mode explains and allows no changes (V-3)", () => {
    const { getByText, queryByRole } = renderUi("modules", {
      state: { adapter: { status: "safe-mode" } },
    });
    expect(getByText(/does not support Foundry 14.369 yet/)).toBeTruthy();
    expect(queryByRole("button", { name: "Export library" })).toBeNull();
  });

  test("an untested build is flagged but usable (V-2)", () => {
    const { getByText, getByRole } = renderUi("modules", {
      state: {
        adapter: {
          status: "untested-build",
          adapter: {
            id: "v14",
            generation: 14,
            minBuild: 0,
            maxBuild: 369,
            selectors: {} as never,
            flags: {},
          },
        },
      },
    });
    expect(getByText(/newer than the builds/)).toBeTruthy();
    expect(getByRole("button", { name: "+ New folder" })).toBeTruthy();
  });
});
