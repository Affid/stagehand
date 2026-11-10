// @vitest-environment happy-dom
// The note our Setup page leaves at a launch, for the app's running screen
// on /join: which world, how many changes go with it (owner, 2026-11-09).
import { afterEach, describe, expect, test } from "vitest";
import {
  clearLaunchNote,
  currentLaunchNote,
  readLaunchNote,
  updateLaunchNote,
  writeLaunchNote,
} from "../../src/app/launch-note.ts";

afterEach(() => {
  sessionStorage.clear();
});

describe("the launch note", () => {
  test("read back for the world launched, while recent", () => {
    writeLaunchNote(sessionStorage, "strahd", 2, 1_000);
    expect(readLaunchNote(sessionStorage, "strahd", 2_000)).toEqual({
      changes: 2,
    });
  });

  test("another world, an old note or a broken one count for nothing", () => {
    writeLaunchNote(sessionStorage, "strahd", 2, 1_000);
    expect(readLaunchNote(sessionStorage, "other", 2_000)).toBeUndefined();
    expect(
      readLaunchNote(sessionStorage, "strahd", 1_000 + 31 * 60_000),
    ).toBeUndefined();
    sessionStorage.setItem("st-launch", "{broken");
    expect(readLaunchNote(sessionStorage, "strahd", 2_000)).toBeUndefined();
    sessionStorage.setItem(
      "st-launch",
      JSON.stringify({ world: "strahd", changes: -1, at: 1_000 }),
    );
    expect(readLaunchNote(sessionStorage, "strahd", 2_000)).toBeUndefined();
  });

  test("applying out of sight is added to it: started, acknowledged, the result (phase 7)", () => {
    writeLaunchNote(sessionStorage, "strahd", 2, 1_000);
    updateLaunchNote(sessionStorage, { applyingAt: 1_500 });
    updateLaunchNote(sessionStorage, { acked: true });
    expect(readLaunchNote(sessionStorage, "strahd", 2_000)).toEqual({
      changes: 2,
      applyingAt: 1_500,
      acked: true,
    });
    updateLaunchNote(sessionStorage, { result: { ok: false, reason: "No" } });
    expect(currentLaunchNote(sessionStorage, 2_000)).toEqual({
      world: "strahd",
      changes: 2,
      applyingAt: 1_500,
      acked: true,
      result: { ok: false, reason: "No" },
    });
  });

  test("nothing to add to without a note; a stale one isn't current", () => {
    updateLaunchNote(sessionStorage, { acked: true });
    expect(currentLaunchNote(sessionStorage, 2_000)).toBeUndefined();
    writeLaunchNote(sessionStorage, "strahd", 2, 1_000);
    expect(
      currentLaunchNote(sessionStorage, 1_000 + 31 * 60_000),
    ).toBeUndefined();
  });

  test("cleared once used", () => {
    writeLaunchNote(sessionStorage, "strahd", 2, 1_000);
    clearLaunchNote(sessionStorage);
    expect(readLaunchNote(sessionStorage, "strahd", 2_000)).toBeUndefined();
  });

  test("storage that throws (blocked) is no note, and no error", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => {
      writeLaunchNote(blocked, "strahd", 1, 0);
    }).not.toThrow();
    expect(readLaunchNote(blocked, "strahd", 0)).toBeUndefined();
  });
});
