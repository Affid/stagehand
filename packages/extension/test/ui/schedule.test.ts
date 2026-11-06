import { describe, expect, test } from "vitest";
import {
  addMonths,
  nextOf,
  type Schedule,
  upcoming,
  zonedToUtc,
} from "../../src/ui/model/schedule.ts";

const NOW = zonedToUtc("2026-11-06", "12:00", "Europe/Berlin");

const weekly: Schedule = {
  start: "2026-11-10",
  time: "19:00",
  tz: "Europe/Berlin",
  freq: "w1",
  skips: ["2026-11-17"],
};

describe("a wall-clock time in a time zone", () => {
  test("is the right UTC instant, winter and summer", () => {
    expect(
      new Date(
        zonedToUtc("2026-11-10", "19:00", "Europe/Berlin"),
      ).toISOString(),
    ).toBe("2026-11-10T18:00:00.000Z");
    expect(
      new Date(
        zonedToUtc("2026-07-10", "19:00", "Europe/Berlin"),
      ).toISOString(),
    ).toBe("2026-07-10T17:00:00.000Z");
    expect(
      new Date(zonedToUtc("2026-11-10", "19:00", "UTC")).toISOString(),
    ).toBe("2026-11-10T19:00:00.000Z");
  });

  test("keeps the wall-clock time across a daylight saving change", () => {
    // Berlin leaves summer time on 25 October 2026.
    const before = zonedToUtc("2026-10-20", "19:00", "Europe/Berlin");
    const after = zonedToUtc("2026-10-27", "19:00", "Europe/Berlin");
    expect(after - before).toBe(7 * 24 * 3600 * 1000 + 3600 * 1000);
  });
});

describe("the schedule's dates", () => {
  test("weekly from the start, skipped dates marked, past ones left out", () => {
    const dates = upcoming(weekly, NOW, 3);
    expect(dates.map((d) => [d.date, d.skipped])).toEqual([
      ["2026-11-10", false],
      ["2026-11-17", true],
      ["2026-11-24", false],
    ]);
    expect(nextOf(weekly, NOW)?.date).toBe("2026-11-10");
  });

  test("every two weeks, and monthly on the same date", () => {
    expect(
      upcoming({ ...weekly, freq: "w2", skips: [] }, NOW, 2).map((d) => d.date),
    ).toEqual(["2026-11-10", "2026-11-24"]);
    expect(
      upcoming({ ...weekly, freq: "m1", skips: [] }, NOW, 3).map((d) => d.date),
    ).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
    expect(addMonths("2027-01-31", 1)).toBe("2027-03-03");
  });

  test("a date that doesn't repeat is next only until it passes", () => {
    const once: Schedule = { ...weekly, freq: "none", skips: [] };
    expect(nextOf(once, NOW)?.date).toBe("2026-11-10");
    expect(nextOf(once, zonedToUtc("2026-11-11", "12:00", "UTC"))).toBe(null);
  });

  test("chosen dates, each with its own time; past ones drop off", () => {
    const chosen: Schedule = {
      ...weekly,
      freq: "dates",
      skips: [],
      dates: {
        "2026-11-01": "15:00",
        "2026-11-14": "15:00",
        "2026-11-27": "19:30",
      },
    };
    expect(upcoming(chosen, NOW, 9).map((d) => [d.date, d.time])).toEqual([
      ["2026-11-14", "15:00"],
      ["2026-11-27", "19:30"],
    ]);
  });

  test("a skipped next date moves to the one after", () => {
    const skipFirst: Schedule = { ...weekly, skips: ["2026-11-10"] };
    expect(nextOf(skipFirst, NOW)?.date).toBe("2026-11-17");
  });
});
