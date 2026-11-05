// @vitest-environment happy-dom
import { cleanup, fireEvent, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderUi, sent, setupState } from "./harness.tsx";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("preset editor (P-1, P-2, P-7)", () => {
  test("creates a preset from the draft, without the companion", async () => {
    const { findByRole, getByRole, send, store } = renderUi("overlay", {
      state: {
        editingPreset: "new",
        draftModules: ["b", "module-library"],
        selection: ["b"],
      },
    });
    fireEvent.input(await findByRole("textbox", { name: "Name" }), {
      target: { value: "Mine" },
    });
    fireEvent.click(getByRole("checkbox", { name: /Title a/ }));
    fireEvent.click(getByRole("button", { name: "Save preset" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: {
          op: "preset.create",
          preset: expect.objectContaining({
            name: "Mine",
            modules: ["b", "a"],
            source: "user",
          }),
        },
      }),
    );
    await waitFor(() => expect(store.get().editingPreset).toBeNull());
    // Regression: the selection used to leak into the next preset.
    expect(store.get().selection).toEqual([]);
  });

  test("edits with its revision, filters modules, and deletes", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const { findByRole, getByRole, queryByRole, send } = renderUi("overlay", {
      state: { editingPreset: "p1" },
    });
    fireEvent.input(await findByRole("searchbox", { name: "Filter modules" }), {
      target: { value: "title b" },
    });
    expect(queryByRole("checkbox", { name: /Title a/ })).toBeNull();
    fireEvent.click(getByRole("checkbox", { name: /Title b/ }));
    fireEvent.click(getByRole("button", { name: "Save preset" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: {
          op: "preset.update",
          id: "p1",
          baseRevision: 3,
          changes: { name: "QoL", description: "", modules: ["a", "c", "b"] },
        },
      }),
    );
  });

  test("delete asks first and sends preset.delete", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const { findByRole, send } = renderUi("overlay", {
      state: { editingPreset: "p1" },
    });
    fireEvent.click(await findByRole("button", { name: "Delete preset" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: { op: "preset.delete", id: "p1", baseRevision: 3 },
      }),
    );
  });
});

describe("preset editor: review fixes (D-2)", () => {
  test("after a conflict the editor closes instead of keeping a stale form", async () => {
    const newer = setupState({
      library: {
        ...setupState().library,
        presets: [{ ...setupState().library.presets[0]!, revision: 4 }],
      },
    });
    const { findByRole, send, store } = renderUi("overlay", {
      state: { editingPreset: "p1" },
      reply: (m) =>
        m.kind === "get-state"
          ? newer
          : {
              ok: false,
              conflict: { entity: "preset", id: "p1", current: {} },
            },
    });
    fireEvent.click(await findByRole("button", { name: "Save preset" }));
    await waitFor(() => expect(store.get().editingPreset).toBeNull());
    const ops = sent(send).filter(
      (m) => (m as { kind: string }).kind === "library-op",
    );
    expect(ops).toHaveLength(1);
  });

  test("a preset deleted elsewhere is not resurrected", async () => {
    const { findByText, queryByRole } = renderUi("overlay", {
      state: { editingPreset: "deleted-id" },
    });
    expect(await findByText(/deleted elsewhere/)).toBeTruthy();
    expect(queryByRole("button", { name: "Save preset" })).toBeNull();
  });
});
