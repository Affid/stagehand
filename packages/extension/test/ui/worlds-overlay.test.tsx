// @vitest-environment happy-dom
import { cleanup, fireEvent, waitFor } from "@testing-library/preact";
import type { Command } from "@module-library/shared/world";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderUi, sent, setupState } from "./harness.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pending: Command = {
  id: "c1",
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: ["p1"] },
  createdAt: "t",
  baseSnapshotAt: null,
  status: "pending",
};

const snapshot = {
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: [
    { id: "module-library", version: "0.1.0" },
    { id: "b", version: "1.0.0" },
  ],
  companionVersion: "0.1.0",
  takenAt: new Date().toISOString(),
};

describe("worlds panel (W-1, W-2, P-5)", () => {
  test("shows status, pending commands with cancel, and failures", async () => {
    const failed = {
      ...pending,
      id: "c2",
      status: "failed" as const,
      error: "Target not reached",
    };
    const { getByText, getByRole, send } = renderUi("worlds", {
      data: { commands: [pending, failed] },
    });
    expect(getByText(/Companion not enabled/)).toBeTruthy();
    expect(getByText("Pending changes (1)")).toBeTruthy();
    expect(getByText("Target not reached")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({ kind: "cancel-command", id: "c1" }),
    );
  });

  test("with a snapshot: active count, age and a preset from the world (P-1)", () => {
    const { getByText, getByRole, store } = renderUi("worlds", {
      data: { snapshots: { w1: snapshot } },
    });
    expect(getByText(/2 active modules/)).toBeTruthy();
    fireEvent.click(
      getByRole("button", { name: "New preset from world Strahd" }),
    );
    expect(store.get()).toMatchObject({
      editingPreset: "new",
      draftModules: ["b"],
    });
    fireEvent.click(getByRole("button", { name: "Apply presets…" }));
    expect(store.get().applyWorld).toBe("w1");
  });
});

describe("apply dialog (P-3, P-4)", () => {
  test("previews dependencies and queues the chosen presets and mode", async () => {
    const reply = (m: { kind: string }) =>
      m.kind === "queue-apply" ? { queued: "c9" } : setupState();
    const { getByRole, getByTestId, getByText, send, store } = renderUi(
      "overlay",
      {
        state: { applyWorld: "w1" },
        reply,
      },
    );
    fireEvent.click(getByRole("checkbox", { name: /QoL/ }));
    await waitFor(() =>
      expect(getByTestId("apply-diff").textContent).toContain("lib"),
    );
    expect(getByText(/No snapshot of this world yet/)).toBeTruthy();
    fireEvent.click(getByRole("radio", { name: /Replace/ }));
    fireEvent.click(getByRole("checkbox", { name: /Also disable/ }));
    fireEvent.click(getByRole("button", { name: "Queue for next launch" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w1",
        mode: "replace",
        presetIds: ["p1"],
      }),
    );
    await waitFor(() => expect(store.get().applyWorld).toBeNull());
  });

  test("shows no change when the world already matches, and closes on Escape", async () => {
    const { getByRole, getByText, store } = renderUi("overlay", {
      state: { applyWorld: "w1" },
      data: {
        snapshots: {
          w1: {
            ...snapshot,
            active: [
              ...snapshot.active,
              { id: "a", version: "1" },
              { id: "c", version: "1" },
              { id: "lib", version: "1" },
            ],
          },
        },
      },
    });
    fireEvent.click(getByRole("checkbox", { name: /QoL/ }));
    await waitFor(() =>
      expect(getByText("No change: the world already matches.")).toBeTruthy(),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(store.get().applyWorld).toBeNull();
  });
});

describe("preset editor (P-1, P-2, P-7)", () => {
  test("creates a preset from the draft, without the companion", async () => {
    const { getByRole, send, store } = renderUi("overlay", {
      state: { editingPreset: "new", draftModules: ["b", "module-library"] },
    });
    fireEvent.input(getByRole("textbox", { name: "Name" }), {
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
  });

  test("edits with its revision, filters modules, and deletes", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const { getByRole, queryByRole, send } = renderUi("overlay", {
      state: { editingPreset: "p1" },
    });
    fireEvent.input(getByRole("searchbox", { name: "Filter modules" }), {
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
    const { getByRole, send } = renderUi("overlay", {
      state: { editingPreset: "p1" },
    });
    fireEvent.click(getByRole("button", { name: "Delete preset" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "library-op",
        op: { op: "preset.delete", id: "p1", baseRevision: 3 },
      }),
    );
  });
});
