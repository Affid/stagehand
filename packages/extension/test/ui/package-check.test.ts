// Our own check of the server's packages, as the UI keeps it (updates plan,
// phase 2): the run's progress, results as they come, saved at the end.
import type { PackageCheck } from "@stagehand/shared/updates/check";
import { describe, expect, test, vi } from "vitest";
import type { PageToUi } from "../../src/page-protocol.ts";
import {
  checkAll,
  checkOne,
  stopCheck,
  trackChecks,
} from "../../src/ui/package-check.ts";
import { createStore } from "../../src/ui/store.ts";
import { fakePage, uiState } from "./harness.tsx";

const NOW = 1_800_000_000_000;

const result = (id: string): PackageCheck => ({
  id,
  type: "module",
  state: "update",
  version: "2.0.0",
  checkedAt: NOW,
});

const ev = (payload: object): PageToUi =>
  ({ type: "PACKAGE_CHECK", payload }) as PageToUi;

function setup() {
  const store = createStore(uiState());
  const { page, emit } = fakePage();
  page.packageCheck.mockReturnValueOnce("run1").mockReturnValueOnce("one1");
  const save = vi.fn(() => Promise.resolve());
  const deps = { store, page, save, now: () => NOW };
  trackChecks(deps);
  return { store, page, emit, save, deps };
}

describe("checking the library", () => {
  test("progress, results as they come, then saved as a full check", async () => {
    const { store, page, emit, save, deps } = setup();
    checkAll(deps);
    expect(page.packageCheck).toHaveBeenCalledWith({ op: "all" });
    expect(store.get().check.running).toEqual({
      requestId: "run1",
      done: 0,
      total: 0,
    });
    emit(
      ev({ requestId: "run1", kind: "tick", done: 1, total: 3, current: "b" }),
    );
    emit(ev({ requestId: "run1", kind: "result", result: result("a") }));
    expect(store.get().check.running).toMatchObject({
      done: 1,
      total: 3,
      current: "b",
    });
    expect(store.get().check.live.a).toEqual(result("a"));
    emit(ev({ requestId: "run1", kind: "done" }));
    await Promise.resolve();
    expect(save).toHaveBeenCalledWith(true, NOW, [result("a")]);
    expect(store.get().check.running).toBe(null);
  });

  test("a second Check again while one runs starts nothing", () => {
    const { page, deps } = setup();
    checkAll(deps);
    checkAll(deps);
    expect(page.packageCheck).toHaveBeenCalledTimes(1);
  });

  test("Stop: the page stops, and what came in is kept without counting as a full check", async () => {
    const { page, emit, save, deps } = setup();
    checkAll(deps);
    stopCheck(deps);
    expect(page.stopPackageCheck).toHaveBeenCalledWith("run1");
    emit(ev({ requestId: "run1", kind: "result", result: result("a") }));
    emit(ev({ requestId: "run1", kind: "done", stopped: true }));
    await Promise.resolve();
    expect(save).toHaveBeenCalledWith(false, NOW, [result("a")]);
  });
});

describe("checking one package", () => {
  test("it is marked while checked, and its result is saved alone", async () => {
    const { store, page, emit, save, deps } = setup();
    page.packageCheck.mockReset().mockReturnValue("one1");
    checkOne(deps, "module", "a");
    expect(page.packageCheck).toHaveBeenCalledWith({
      op: "one",
      type: "module",
      id: "a",
    });
    expect(Object.values(store.get().check.one)).toEqual(["a"]);
    emit(ev({ requestId: "one1", kind: "result", result: result("a") }));
    emit(ev({ requestId: "one1", kind: "done" }));
    await Promise.resolve();
    expect(save).toHaveBeenCalledWith(false, NOW, [result("a")]);
    expect(store.get().check.one).toEqual({});
  });

  test("events of another run are ignored", () => {
    const { store, emit } = setup();
    emit(ev({ requestId: "stray", kind: "result", result: result("x") }));
    expect(store.get().check.live).toEqual({});
  });
});
