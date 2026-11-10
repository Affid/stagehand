// @vitest-environment happy-dom
// Library sync on the page: the notices, the hook on library changes, the
// start and visibility triggers, and the toolbar's state.
import { cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ExtensionMessage } from "../../src/messages.ts";
import { createTranslator } from "../../src/ui/i18n.ts";
import {
  sendNotingChanges,
  startLibrarySync,
  syncNotices,
} from "../../src/ui/library-sync-start.ts";
import { createStore } from "../../src/ui/store.ts";
import type { SyncStatus } from "../../src/ui/library-sync.ts";
import { syncLabel } from "../../src/ui/shell/library/head/SyncState.tsx";
import { fakePage, renderUi, uiState } from "./harness.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const t = createTranslator("en");
const clash = (
  name: string,
  reason: "kept-this-device" | "joined-text" | "kept-edit",
) => ({ kind: "tag", id: name, name, reason }) as const;

describe("sync notices", () => {
  test("one per kind of clash, the replaced file first", () => {
    expect(
      syncNotices(t, {
        clashes: [
          clash("Combat", "kept-this-device"),
          clash("dice", "joined-text"),
        ],
        repaired: true,
      }),
    ).toEqual([
      "The library file on this server could not be read; it was replaced with this device's library.",
      "Also changed on another device; this device's version was kept: Combat",
      "Notes changed on two devices; both were kept: dice",
    ]);
  });

  test("long lists name five and count the rest", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      clash(`t${String(i)}`, "kept-edit"),
    );
    expect(syncNotices(t, { clashes: many, repaired: false })).toEqual([
      "Deleted here but changed on another device, so kept: t0, t1, t2, t3, t4 and 3 more",
    ]);
  });
});

describe("noting library changes", () => {
  test("a library change, an import or sorted modules schedule a sync", async () => {
    const changed = vi.fn();
    const sync = { sync: vi.fn(), changed, flush: vi.fn() };
    const send = sendNotingChanges(
      () => Promise.resolve(undefined as never),
      () => sync,
    );
    await send({ kind: "get-state" });
    expect(changed).not.toHaveBeenCalled();
    await send({ kind: "library-import", text: "{}" });
    await send({ kind: "modules-sorted", ids: ["a"] });
    expect(changed).toHaveBeenCalledTimes(2);
  });

  test("before sync starts, a change is just sent", async () => {
    const send = sendNotingChanges(
      () => Promise.resolve("ok" as never),
      () => undefined,
    );
    await expect(send({ kind: "library-export" })).resolves.toBe("ok");
  });
});

describe("starting sync", () => {
  test("shows each status, syncs when the page shows again, flushes when hidden", async () => {
    const { page } = fakePage();
    const store = createStore(uiState());
    const messages: ExtensionMessage[] = [];
    const sync = startLibrarySync({
      store,
      page,
      send: <T,>(m: ExtensionMessage) => {
        messages.push(m);
        return Promise.resolve({
          ok: true,
          changedLocal: false,
          push: null,
          clashes: [],
          repaired: false,
        } as T);
      },
      t,
      doc: document,
      refresh: () => Promise.resolve(),
    });
    await sync.sync();
    expect(store.get().librarySync).toEqual({ kind: "synced" });
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => {
      expect(messages).toHaveLength(2);
    });
    vi.useFakeTimers();
    sync.changed();
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(10);
    expect(messages).toHaveLength(3);
  });
});

describe("the toolbar's sync state", () => {
  const toolbar = (librarySync?: SyncStatus) =>
    renderUi("shell", {
      state: {
        route: { kind: "library" },
        ...(librarySync ? { librarySync } : {}),
      },
    });

  test("is absent until sync runs", () => {
    expect(toolbar().container.querySelector(".stl-sync")).toBeNull();
  });

  test("synced is a quiet icon with its words in the tooltip", () => {
    const sync = toolbar({ kind: "synced" }).container.querySelector(
      ".stl-sync",
    );
    expect(sync?.getAttribute("title")).toBe("Library synced with this server");
    expect(sync?.textContent).toBe("");
    expect(sync?.querySelector("i")?.className).toContain("fa-cloud");
  });

  test("syncing spins", () => {
    const sync = toolbar({ kind: "syncing" }).container.querySelector(
      ".stl-sync i",
    );
    expect(sync?.className).toContain("fa-spin");
  });

  test("a failure says so, with the reason in the tooltip", () => {
    const sync = toolbar({
      kind: "failed",
      reason: "write",
      error: "No permission.",
    }).container.querySelector(".stl-sync");
    expect(sync?.textContent).toBe("Library not synced");
    expect(sync?.getAttribute("title")).toBe(
      "Library not synced: Foundry did not save the library file: No permission.",
    );
  });

  test("a newer Stagehand is named as the reason", () => {
    expect(syncLabel(t, { kind: "failed", reason: "newer" })).toContain(
      "newer version of Stagehand",
    );
  });
});
