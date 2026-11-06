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
