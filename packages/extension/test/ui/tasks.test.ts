import { describe, expect, test } from "vitest";
import { tasksFor, trackProgress } from "../../src/ui/tasks.ts";
import { createStore } from "../../src/ui/store.ts";
import { fakePage, uiState } from "./harness.tsx";

const tick = (over: object) => ({
  type: "PROGRESS" as const,
  payload: {
    action: "createBackup" as const,
    id: "world.w1.2026-11-06.1",
    packageId: "w1",
    type: "world",
    ...over,
  },
});

describe("Foundry's running tasks", () => {
  test("a tick starts or moves a task; its end removes it", () => {
    const store = createStore(uiState());
    const { page, emit } = fakePage();
    trackProgress(store, page);
    emit(tick({ pct: 10, step: "archive" }));
    emit(tick({ pct: 40, step: "archive" }));
    expect(store.get().tasks).toEqual([
      expect.objectContaining({ pct: 40, packageId: "w1" }),
    ]);
    expect(tasksFor(store.get(), "w1")).toHaveLength(1);
    expect(tasksFor(store.get(), "w2")).toHaveLength(0);
    emit(tick({ step: "complete" }));
    expect(store.get().tasks).toEqual([]);
  });

  test("an error ends it too, and Foundry's lock is kept", () => {
    const store = createStore(uiState());
    const { page, emit } = fakePage();
    trackProgress(store, page);
    emit({
      type: "LOCK",
      payload: { locked: true, message: "SETUP.BACKUPS.BackingUp" },
    });
    emit(tick({ pct: 5 }));
    emit(tick({ step: "error" }));
    expect(store.get().tasks).toEqual([]);
    expect(store.get().lock).toEqual({
      locked: true,
      message: "SETUP.BACKUPS.BackingUp",
    });
    emit({ type: "LOCK", payload: { locked: false } });
    expect(store.get().lock.locked).toBe(false);
  });
});

describe("odd lock messages (security review)", () => {
  test("a message naming an object's own key reads as busy, not a crash", async () => {
    const { lockReason } = await import("../../src/ui/tasks.ts");
    const t = (k: string): string => k;
    for (const message of ["constructor", "__proto__", "toString"])
      expect(
        lockReason(t, { lock: { locked: true, message }, tasks: [] }),
      ).toBe("lock.busy");
  });
});

describe("a step without a number (code review)", () => {
  test("a new step doesn't carry the last step's percent", () => {
    const store = createStore(uiState());
    const { page, emit } = fakePage();
    trackProgress(store, page);
    const snap = (over: object) => ({
      type: "PROGRESS" as const,
      payload: { action: "createSnapshot" as const, id: "snapshot.1", ...over },
    });
    emit(snap({ step: "snapshotModules", pct: 100 }));
    emit(snap({ step: "snapshotSystems" }));
    expect(store.get().tasks[0]?.pct).toBeUndefined();
    emit(snap({ step: "snapshotSystems", pct: 40 }));
    emit(snap({ step: "snapshotSystems" }));
    expect(store.get().tasks[0]?.pct).toBe(40);
  });
});
