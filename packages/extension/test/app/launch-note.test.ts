// @vitest-environment happy-dom
// The note our Setup page leaves at a launch, for the app's running screen
// on /join: which world, how many changes go with it (owner, 2026-11-09).
import { afterEach, describe, expect, test } from "vitest";
import {
  clearLaunchNote,
  readLaunchNote,
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
    sessionStorage.setItem("ml-launch", "{broken");
    expect(readLaunchNote(sessionStorage, "strahd", 2_000)).toBeUndefined();
    sessionStorage.setItem(
      "ml-launch",
      JSON.stringify({ world: "strahd", changes: -1, at: 1_000 }),
    );
    expect(readLaunchNote(sessionStorage, "strahd", 2_000)).toBeUndefined();
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
