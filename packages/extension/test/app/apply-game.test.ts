// @vitest-environment happy-dom
// The hidden game page while the app applies a launch's changes (phase 7):
// it watches only when the launch note says applying, records the result
// and tells native, once; it gives up before native's own limit.
import { makeEnvelope } from "@module-library/shared/protocol";
import { afterEach, describe, expect, test, vi } from "vitest";
import { applyWatcher } from "../../src/app/apply-game.ts";
import {
  currentLaunchNote,
  updateLaunchNote,
  writeLaunchNote,
} from "../../src/app/launch-note.ts";

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

const pull = makeEnvelope("module", "COMMANDS_PULL", { worldId: "w" });
const none = makeEnvelope("bridge", "COMMANDS", { world: [] });
const ack = makeEnvelope("module", "COMMAND_ACK", { status: "applying" });
const ok = makeEnvelope("bridge", "OK", { accepted: true });

function applying(at = Date.now()) {
  writeLaunchNote(sessionStorage, "w", 2, at);
  updateLaunchNote(sessionStorage, { applyingAt: at });
}

describe("applyWatcher", () => {
  test("no watch on a game page that isn't applying", () => {
    const done = vi.fn(() => Promise.resolve());
    expect(applyWatcher({ store: sessionStorage, done })).toBeUndefined();
    writeLaunchNote(sessionStorage, "w", 2);
    expect(applyWatcher({ store: sessionStorage, done })).toBeUndefined();
  });

  test("acknowledged, then nothing left after the reload: applied, said once", () => {
    applying();
    const done = vi.fn(() => Promise.resolve());
    const first = applyWatcher({ store: sessionStorage, done });
    first?.(ack, ok);
    expect(currentLaunchNote(sessionStorage)?.acked).toBe(true);
    // The world reloads: a new page, a new watcher, the note remembers.
    const second = applyWatcher({ store: sessionStorage, done });
    second?.(pull, none);
    second?.(pull, none);
    expect(currentLaunchNote(sessionStorage)?.result).toEqual({ ok: true });
    expect(done.mock.calls).toEqual([[true]]);
  });

  test("a failed acknowledgement: the reason, and native told", () => {
    applying();
    const done = vi.fn(() => Promise.resolve());
    applyWatcher({ store: sessionStorage, done })?.(
      makeEnvelope("module", "COMMAND_ACK", { status: "failed", error: "No" }),
      ok,
    );
    expect(currentLaunchNote(sessionStorage)?.result).toEqual({
      ok: false,
      reason: "No",
    });
    expect(done).toHaveBeenCalledWith(false);
  });

  test("no answer in time: given up before native's own limit", () => {
    vi.useFakeTimers();
    applying();
    const done = vi.fn(() => Promise.resolve());
    applyWatcher({ store: sessionStorage, done });
    vi.advanceTimersByTime(4 * 60_000);
    expect(currentLaunchNote(sessionStorage)?.result?.ok).toBe(false);
    expect(done).toHaveBeenCalledWith(false);
  });

  test("a result already there, or too old to still be applying: no watch", () => {
    const done = vi.fn(() => Promise.resolve());
    applying(Date.now() - 5 * 60_000);
    expect(applyWatcher({ store: sessionStorage, done })).toBeUndefined();
    applying();
    updateLaunchNote(sessionStorage, { result: { ok: true } });
    expect(applyWatcher({ store: sessionStorage, done })).toBeUndefined();
  });
});
