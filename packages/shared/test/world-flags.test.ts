import { describe, expect, test } from "vitest";
import {
  activeKey,
  byteSize,
  decodeActive,
  encodeActive,
  FORMAT,
  fitReport,
  launchIsFresh,
  MAX_SAVE_BYTES,
  readStagehand,
  type Report,
} from "../src/world-flags.ts";

const entry = {
  id: "c1",
  mode: "add",
  presets: [{ id: "p1", name: "Combat" }],
  modules: ["dice-so-nice"],
  queuedAt: "2026-11-09T20:00:00.000Z",
};

const report: Report = {
  at: "2026-11-09T20:05:00.000Z",
  companion: "0.2.0",
  core: "14.370",
  system: { id: "dnd5e", version: "6.0.6" },
  active: ["dice-so-nice@5.0.0"],
  versions: true,
  partial: false,
  launchId: null,
  results: [{ id: "c1", status: "applied" }],
};

describe("readStagehand", () => {
  test("reads every field that passes, and only those", () => {
    const read = readStagehand({
      v: FORMAT,
      queue: [entry],
      launch: { kind: "hold", id: "l1", at: "2026-11-09T20:00:00.000Z" },
      report,
    });
    expect(read).toEqual({
      newer: false,
      queue: [entry],
      launch: { kind: "hold", id: "l1", at: "2026-11-09T20:00:00.000Z" },
      report,
    });
  });

  test("a bad field is left out without losing the others", () => {
    const read = readStagehand({ queue: [entry], report: { at: 3 } });
    expect(read.queue).toEqual([entry]);
    expect(read.report).toBeUndefined();
  });

  test("a bad queue entry drops the whole queue (it is never applied half)", () => {
    const read = readStagehand({ queue: [entry, { id: "" }] });
    expect(read.queue).toEqual([]);
    expect(read.unreadable).toBe(true);
  });

  test("a queue too big for its share of a save is unreadable", () => {
    const big = Array.from({ length: 40 }, (_, i) => ({
      ...entry,
      id: `c${String(i)}`,
      modules: Array.from(
        { length: 20 },
        (_, j) => `module-${String(j)}-${"x".repeat(60)}`,
      ),
    }));
    expect(readStagehand({ queue: big })).toEqual({
      newer: false,
      queue: [],
      unreadable: true,
    });
  });

  test("a newer format is left alone", () => {
    expect(readStagehand({ v: FORMAT + 1, queue: [entry] })).toEqual({
      newer: true,
      queue: [],
    });
  });

  test.each([undefined, null, "x", 3, []])("nothing usable in %s", (raw) => {
    expect(readStagehand(raw)).toEqual({ newer: false, queue: [] });
  });

  test("a reviewed launch carries its target", () => {
    const launch = {
      kind: "reviewed",
      id: "l2",
      at: "2026-11-09T20:00:00.000Z",
      target: ["a", "b"],
    };
    expect(readStagehand({ launch }).launch).toEqual(launch);
  });
});

describe("activeKey", () => {
  test("is the same for the same set in any order", () => {
    expect(activeKey(["b", "a"])).toBe(activeKey(["a", "b"]));
  });

  test("differs for different sets", () => {
    expect(activeKey(["a"])).not.toBe(activeKey(["a", "b"]));
    expect(activeKey(["ab"])).not.toBe(activeKey(["a", "b"]));
  });

  test("is short", () => {
    expect(activeKey(["x".repeat(200)]).length).toBeLessThanOrEqual(16);
  });
});

describe("encodeActive / decodeActive", () => {
  test("round-trips ids and versions", () => {
    const active = [
      { id: "a", version: "1.2.3" },
      { id: "b", version: "" },
    ];
    expect(decodeActive(encodeActive(active))).toEqual(active);
  });

  test("a version may itself hold an @", () => {
    expect(decodeActive(["a@1.0@beta"])).toEqual([
      { id: "a", version: "1.0@beta" },
    ]);
  });

  test("an id alone has no version", () => {
    expect(decodeActive(["a"])).toEqual([{ id: "a", version: "" }]);
  });
});

describe("fitReport", () => {
  test("a small report is kept as it is", () => {
    expect(fitReport(report, 0)).toEqual(report);
  });

  test("a large one loses its versions first", () => {
    const active = Array.from(
      { length: 2000 },
      (_, i) => `module-number-${String(i)}@12.345.6789-beta.1+build.20261109`,
    );
    const fitted = fitReport({ ...report, active }, 0);
    expect(fitted.versions).toBe(false);
    expect(fitted.active).toHaveLength(2000);
    expect(fitted.active[0]).toBe("module-number-0");
    expect(byteSize(fitted)).toBeLessThan(MAX_SAVE_BYTES);
  });

  test("and then is cut, said", () => {
    const active = Array.from(
      { length: 2000 },
      (_, i) => `${"m".repeat(60)}-${String(i)}`,
    );
    const fitted = fitReport({ ...report, active }, 0);
    expect(fitted.partial).toBe(true);
    expect(fitted.active.length).toBeLessThan(2000);
    expect(byteSize(fitted)).toBeLessThan(MAX_SAVE_BYTES);
  });

  test("leaves room for the rest of the save", () => {
    const active = Array.from(
      { length: 1500 },
      (_, i) => `module-number-${String(i)}@1.0.0`,
    );
    const fitted = fitReport({ ...report, active }, 60_000);
    expect(byteSize(fitted) + 60_000).toBeLessThan(MAX_SAVE_BYTES);
  });
});

describe("launchIsFresh", () => {
  const start = Date.parse("2026-11-09T20:00:00.000Z");

  test("written shortly before the world started", () => {
    expect(launchIsFresh("2026-11-09T19:58:00.000Z", start)).toBe(true);
  });

  test("written long before: a leftover", () => {
    expect(launchIsFresh("2026-11-09T19:00:00.000Z", start)).toBe(false);
  });

  test("written after the start: not this launch's", () => {
    expect(launchIsFresh("2026-11-09T20:05:00.000Z", start)).toBe(false);
  });

  test("a little after allows for the clocks' rounding", () => {
    expect(launchIsFresh("2026-11-09T20:00:01.000Z", start)).toBe(true);
  });

  test("an unreadable time is not fresh", () => {
    expect(launchIsFresh("soon", start)).toBe(false);
  });
});
