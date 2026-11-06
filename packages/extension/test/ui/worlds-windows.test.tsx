// @vitest-environment happy-dom
import { cleanup, fireEvent, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FALLBACK_MS } from "../../src/ui/common/FoundryWindow.tsx";
import { renderUi, sent, setupState } from "./harness.tsx";
import { pending, snapshot } from "./worlds-fixtures.ts";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("Foundry windows", () => {
  test("open in Foundry's frame with a title and icon, and close with it", async () => {
    const { findByText, page, closeTopWindow, store } = renderUi("overlay", {
      state: { sheetWorld: "w1" },
    });
    expect(await findByText("Not tracked")).toBeTruthy();
    expect(page.openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Strahd", icon: "fa-solid fa-globe" }),
    );
    closeTopWindow();
    expect(store.get().sheetWorld).toBeNull();
  });

  test("fall back to our own modal when Foundry can't open one", async () => {
    vi.useFakeTimers();
    const { queryByText, getByText, store } = renderUi("overlay", {
      state: { sheetWorld: "w1" },
      windows: false,
    });
    expect(queryByText("Not tracked")).toBeNull();
    await vi.advanceTimersByTimeAsync(FALLBACK_MS);
    expect(getByText("Not tracked")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(100);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(store.get().sheetWorld).toBeNull();
  });

  test("closing from our side closes Foundry's window", async () => {
    const { findByRole, page, store } = renderUi("overlay", {
      state: { apply: { worldId: "w1" } },
    });
    fireEvent.click(await findByRole("button", { name: "Cancel" }));
    expect(store.get().apply).toBeNull();
    expect(page.closeWindow).toHaveBeenCalled();
  });
});

describe("world sheet (W-1 to W-3)", () => {
  test("shows status, the queue with cancel, the combined result, history", async () => {
    const failed = {
      ...pending,
      id: "c0",
      status: "failed" as const,
      error: "Target not reached",
    };
    const { findByText, getByText, getByRole, send } = renderUi("overlay", {
      state: { sheetWorld: "w1" },
      data: { snapshots: { w1: snapshot() }, commands: [failed, pending] },
    });
    expect(await findByText("Tracked · 2 active modules")).toBeTruthy();
    expect(getByText("1 queued")).toBeTruthy();
    expect(getByText("Target not reached")).toBeTruthy();
    expect(getByText(/Result after next launch: 2 → 5 modules/)).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Show" }));
    expect(getByText("Title a")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Cancel change 1" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({ kind: "cancel-command", id: "c1" }),
    );
  });

  test("picked modules are named in the queue: by title when few, else counted", async () => {
    const few = {
      ...pending,
      id: "c2",
      payload: { mode: "remove" as const, presetIds: [], modules: ["a"] },
    };
    const many = {
      ...pending,
      id: "c3",
      payload: {
        mode: "add" as const,
        presetIds: [],
        modules: ["a", "b", "c", "d"],
      },
    };
    const { findByText, getByText } = renderUi("overlay", {
      state: { sheetWorld: "w1" },
      data: { snapshots: { w1: snapshot() }, commands: [few, many] },
    });
    expect(await findByText("Title a")).toBeTruthy();
    expect(getByText("4 picked modules")).toBeTruthy();
  });

  test("actions: preset from world, apply, and Foundry's own launch", async () => {
    const list = document.createElement("ol");
    list.id = "worlds-list";
    list.innerHTML =
      '<li class="package world" data-package-id="w1"><a data-action="worldLaunch"></a></li>';
    document.body.append(list);
    const launched = vi.fn();
    list.querySelector("a")!.addEventListener("click", launched);
    const { findByRole, getByRole, store } = renderUi("overlay", {
      state: { sheetWorld: "w1" },
      data: { snapshots: { w1: snapshot() } },
    });
    fireEvent.click(
      await findByRole("button", { name: "New preset from world" }),
    );
    expect(store.get()).toMatchObject({
      editingPreset: "new",
      draftModules: ["b"],
    });
    fireEvent.click(getByRole("button", { name: "Apply presets…" }));
    expect(store.get().apply).toEqual({ worldId: "w1" });
    fireEvent.click(getByRole("button", { name: "Launch world" }));
    expect(launched).toHaveBeenCalledOnce();
    expect(store.get().sheetWorld).toBeNull();
  });

  test("cancel all queued, and launch disabled without a launch control", async () => {
    const second = { ...pending, id: "c2" };
    const { findByRole, getByRole, send } = renderUi("overlay", {
      state: { sheetWorld: "w1" },
      data: { commands: [pending, second] },
    });
    expect(
      (await findByRole("button", { name: "Launch world" })).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    fireEvent.click(getByRole("button", { name: "Cancel all queued" }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({ kind: "cancel-command", id: "c2" }),
    );
  });

  test("a world that disappeared says so", async () => {
    const { findByText } = renderUi("overlay", {
      state: { sheetWorld: "gone" },
    });
    expect(await findByText(/no longer on this server/)).toBeTruthy();
  });
});

describe("apply dialog (P-3 to P-6)", () => {
  test("previews by title, problems first, and queues the choice", async () => {
    const reply = (m: { kind: string }) =>
      m.kind === "queue-apply" ? { queued: "c9" } : setupState();
    const { findByRole, getByRole, getByTestId, getByText, send, store, page } =
      renderUi("overlay", { state: { apply: { worldId: "w1" } }, reply });
    expect(
      await findByRole("button", { name: "Queue for next launch" }),
    ).toHaveProperty("disabled", true);
    expect(
      getByText("Choose one or more presets to see what changes."),
    ).toBeTruthy();
    fireEvent.click(getByRole("checkbox", { name: /QoL/ }));
    await waitFor(() =>
      expect(getByTestId("apply-diff").textContent).toContain("Title lib"),
    );
    expect(getByText(/No snapshot of this world yet/)).toBeTruthy();
    expect(getByText("1 selected · 2 modules")).toBeTruthy();
    fireEvent.click(getByRole("radio", { name: /Replace/ }));
    fireEvent.click(getByRole("checkbox", { name: /Also disable/ }));
    fireEvent.click(getByRole("button", { name: /Queue for next launch/ }));
    await waitFor(() =>
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w1",
        mode: "replace",
        presetIds: ["p1"],
      }),
    );
    await waitFor(() => expect(store.get().apply).toBeNull());
    expect(page.notify).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Queued for Strahd"),
    );
  });

  test("includes what is already queued, and warns when the snapshot is old", async () => {
    const old = snapshot({ takenAt: "2026-10-01T00:00:00.000Z" });
    const base = setupState();
    const world = {
      ...base.setup!.worlds[0]!,
      lastPlayed: "2026-11-01T00:00:00.000Z",
    };
    const { findByText, getByText } = renderUi("overlay", {
      state: { apply: { worldId: "w1" } },
      data: {
        setup: { ...base.setup!, worlds: [world] },
        snapshots: { w1: old },
        commands: [pending],
      },
    });
    expect(await findByText("Includes 1 change already queued")).toBeTruthy();
    expect(getByText(/played since/)).toBeTruthy();
    expect(document.querySelector(".ml-before-after")?.textContent).toBe(
      "25active modules",
    );
  });

  test("without a world, a picker comes first", async () => {
    const { findByRole, getByText } = renderUi("overlay", {
      state: { apply: { worldId: null } },
    });
    const select = await findByRole("combobox", { name: "World" });
    expect(getByText("Choose a world to see what changes.")).toBeTruthy();
    fireEvent.change(select, { target: { value: "w1" } });
    expect(
      getByText("Choose one or more presets to see what changes."),
    ).toBeTruthy();
  });

  test("shows no change when the world already matches", async () => {
    const { findByRole, getByText } = renderUi("overlay", {
      state: { apply: { worldId: "w1" } },
      data: {
        snapshots: {
          w1: snapshot({
            active: [
              { id: "module-library", version: "1" },
              { id: "a", version: "1" },
              { id: "c", version: "1" },
              { id: "lib", version: "1" },
            ],
          }),
        },
      },
    });
    fireEvent.click(await findByRole("checkbox", { name: /QoL/ }));
    await waitFor(() =>
      expect(getByText("No change: the world already matches.")).toBeTruthy(),
    );
  });
});

describe("apply dialog: review fixes", () => {
  test("a double click queues once", async () => {
    let release = (): void => undefined;
    const reply = (m: { kind: string }) =>
      m.kind === "queue-apply"
        ? new Promise((r) => {
            release = () => {
              r({ queued: "c9" });
            };
          })
        : setupState();
    const { findByRole, getByRole, send } = renderUi("overlay", {
      state: { apply: { worldId: "w1" } },
      reply,
    });
    fireEvent.click(await findByRole("checkbox", { name: /QoL/ }));
    const button = getByRole("button", { name: /Queue for next launch/ });
    fireEvent.click(button);
    fireEvent.click(button);
    release();
    await waitFor(() =>
      expect(
        sent(send).filter(
          (m) => (m as { kind: string }).kind === "queue-apply",
        ),
      ).toHaveLength(1),
    );
  });

  test("a queued change whose preset was deleted is left out and flagged", async () => {
    const orphan = {
      ...pending,
      id: "c7",
      payload: { mode: "replace" as const, presetIds: ["gone"] },
    };
    const { findByText } = renderUi("overlay", {
      state: { apply: { worldId: "w1" } },
      data: { snapshots: { w1: snapshot() }, commands: [orphan] },
    });
    expect(
      await findByText(/uses a deleted preset and will fail/),
    ).toBeTruthy();
  });

  test("a late Foundry window after our modal is closed, not swapped in", async () => {
    vi.useFakeTimers();
    const { emit, page, getByText } = renderUi("overlay", {
      state: { sheetWorld: "w1" },
      windows: false,
    });
    await vi.advanceTimersByTimeAsync(FALLBACK_MS);
    expect(getByText("Not tracked")).toBeTruthy();
    const id = (page.openWindow.mock.calls[0]?.[0] as { id: string }).id;
    emit({ type: "WINDOW_READY", payload: { id } });
    expect(page.closeWindow).toHaveBeenCalledWith(id);
    expect(getByText("Not tracked")).toBeTruthy();
  });
});
