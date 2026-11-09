// @vitest-environment happy-dom
// The hidden game page while the app applies a launch's changes (phase 7):
// it watches only when the launch note says applying, records the result
// and tells native, once; it gives up before native's own limit.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { startApplyWatch, WATCH_EVERY_MS } from "../../src/app/apply-game.ts";
import {
  currentLaunchNote,
  updateLaunchNote,
  writeLaunchNote,
} from "../../src/app/launch-note.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

function applying(at = Date.now()) {
  writeLaunchNote(sessionStorage, "w", 2, at, {
    launchId: "l1",
    ids: ["c1", "c2"],
  });
  updateLaunchNote(sessionStorage, { applyingAt: at });
}

const report = (results: unknown[]) => ({
  v: 1,
  report: {
    at: "2026-11-09T20:00:00.000Z",
    companion: "0.2.0",
    core: "14.370",
    system: { id: "dnd5e", version: "6.0.6" },
    active: [],
    versions: true,
    partial: false,
    launchId: "l1",
    results,
  },
});

describe("startApplyWatch", () => {
  test("no watch on a game page that isn't applying", () => {
    const done = vi.fn(() => Promise.resolve());
    const flags = () => undefined;
    expect(
      startApplyWatch({ store: sessionStorage, done, flags }),
    ).toBeUndefined();
    writeLaunchNote(sessionStorage, "w", 2);
    expect(
      startApplyWatch({ store: sessionStorage, done, flags }),
    ).toBeUndefined();
  });

  test("taken up, then applied after the reload: done, said once", () => {
    applying();
    const done = vi.fn(() => Promise.resolve());
    let flags: unknown = report([
      { id: "c1", status: "applying", targetKey: "k" },
      { id: "c2", status: "applying", targetKey: "k" },
    ]);
    const stop = startApplyWatch({
      store: sessionStorage,
      done,
      flags: () => flags,
    });
    vi.advanceTimersByTime(WATCH_EVERY_MS);
    expect(currentLaunchNote(sessionStorage)?.acked).toBe(true);
    stop?.();
    // The world reloads: a new page, a new watch; the note remembers.
    flags = report([
      { id: "c1", status: "applied" },
      { id: "c2", status: "applied" },
    ]);
    startApplyWatch({ store: sessionStorage, done, flags: () => flags });
    vi.advanceTimersByTime(WATCH_EVERY_MS * 3);
    expect(currentLaunchNote(sessionStorage)?.result).toEqual({ ok: true });
    expect(done.mock.calls).toEqual([[true]]);
  });

  test("failed: the reason, and native told", () => {
    applying();
    const done = vi.fn(() => Promise.resolve());
    const flags = report([{ id: "c1", status: "failed", error: "No" }]);
    startApplyWatch({ store: sessionStorage, done, flags: () => flags });
    vi.advanceTimersByTime(WATCH_EVERY_MS);
    expect(currentLaunchNote(sessionStorage)?.result).toEqual({
      ok: false,
      reason: "No",
    });
    expect(done).toHaveBeenCalledWith(false);
  });

  test("no answer in time: given up before native's own limit", () => {
    applying();
    const done = vi.fn(() => Promise.resolve());
    startApplyWatch({ store: sessionStorage, done, flags: () => undefined });
    vi.advanceTimersByTime(4 * 60_000);
    expect(currentLaunchNote(sessionStorage)?.result?.ok).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(false);
  });

  test("a result already there, or too old to still be applying: no watch", () => {
    const done = vi.fn(() => Promise.resolve());
    const flags = () => undefined;
    applying(Date.now() - 5 * 60_000);
    expect(
      startApplyWatch({ store: sessionStorage, done, flags }),
    ).toBeUndefined();
    applying();
    updateLaunchNote(sessionStorage, { result: { ok: true } });
    expect(
      startApplyWatch({ store: sessionStorage, done, flags }),
    ).toBeUndefined();
  });
});
