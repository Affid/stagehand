import { describe, expect, test } from "vitest";
import {
  addMonths,
  nextOf,
  type Schedule,
  upcoming,
  usedTimes,
  zonedToUtc,
} from "../../src/ui/model/schedule.ts";
import {
  dateLabel,
  otherZones,
} from "../../src/ui/shell/world/about/session/text.ts";

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
    // The 31st in a shorter month is that month's last day.
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    const endOfMonth: Schedule = {
      ...weekly,
      start: "2026-11-30",
      freq: "m1",
      skips: [],
    };
    expect(upcoming(endOfMonth, NOW, 4).map((d) => d.date)).toEqual([
      "2026-11-30",
      "2026-12-30",
      "2027-01-30",
      "2027-02-28",
    ]);
  });

  test("a rule started years ago still has its next dates (review)", () => {
    const old: Schedule = { ...weekly, start: "2020-01-07", skips: [] };
    expect(upcoming(old, NOW, 2).map((d) => d.date)).toEqual([
      "2026-11-10",
      "2026-11-17",
    ]);
    const monthly: Schedule = {
      ...weekly,
      start: "2010-01-10",
      freq: "m1",
      skips: [],
    };
    expect(nextOf(monthly, NOW)?.date).toBe("2026-11-10");
    const fortnightly: Schedule = {
      ...weekly,
      start: "2026-11-10",
      freq: "w2",
      skips: [],
    };
    const later = zonedToUtc("2031-06-01", "12:00", "UTC");
    expect(nextOf(fortnightly, later)?.ms).toBeGreaterThan(later);
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

describe("a calendar day's name (Phase 6, label in content)", () => {
  test("says the date in words and holds the day number shown", async () => {
    const { dayName } =
      await import("../../src/ui/shell/world/about/session/text.ts");
    expect(dayName("2026-11-01")).toBe("Sunday, 1 November 2026");
    expect(dayName("2026-02-28")).toContain("28");
    expect(dayName("not a date")).toBe("not a date");
  });
});

describe("quick times from the owner's own schedules", () => {
  const chosen: Schedule = {
    ...weekly,
    freq: "dates",
    skips: [],
    dates: { "2026-11-14": "15:00", "2026-11-27": "21:15" },
  };

  test("most used first, then the defaults, at most five, sorted", () => {
    const mine = [
      { ...weekly, time: "20:15" },
      { ...weekly, time: "20:15" },
      chosen,
    ];
    const { list, fromYou } = usedTimes(mine, "20:15");
    expect(list).toEqual(["15:00", "18:00", "18:30", "20:15", "21:15"]);
    expect([...fromYou].sort()).toEqual(["15:00", "20:15", "21:15"]);
  });

  test("a chosen date's own time counts, not the usual time", () => {
    const { fromYou } = usedTimes([chosen], "19:00");
    expect(fromYou.has("19:00")).toBe(false);
    expect(fromYou.has("21:15")).toBe(true);
  });

  test("without schedules it is the defaults", () => {
    expect(usedTimes([], "19:00").list).toEqual([
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
  });

  test("the current time is always there", () => {
    const { list } = usedTimes([], "07:45");
    expect(list).toHaveLength(5);
    expect(list).toContain("07:45");
    expect(list[0]).toBe("07:45");
  });

  test("a stored time that is not HH:MM is ignored", () => {
    const odd = { ...weekly, time: "late" };
    expect(usedTimes([odd], "19:00").list).not.toContain("late");
  });
});

describe("the time players see, for example", () => {
  test("three zones with the weekday when the day differs", () => {
    const ms = zonedToUtc("2026-11-10", "19:00", "Europe/Berlin");
    expect(otherZones(ms, "Europe/Berlin")).toEqual([
      { time: "18:00", city: "London", weekday: "" },
      { time: "13:00", city: "New York", weekday: "" },
      { time: "05:00", city: "Sydney", weekday: "Wed" },
    ]);
  });

  test("the schedule's own zone is left out", () => {
    const ms = zonedToUtc("2026-11-10", "19:00", "Europe/London");
    expect(otherZones(ms, "Europe/London").map((x) => x.city)).toEqual([
      "New York",
      "Sydney",
    ]);
  });
});

describe("a chosen date's label", () => {
  test("weekday, day and month; the year only when it is not this year", () => {
    expect(dateLabel("2026-11-10", 2026)).toBe("Tue 10 Nov");
    expect(dateLabel("2027-01-05", 2026)).toBe("Tue 5 Jan 2027");
  });
});
