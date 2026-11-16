import { describe, expect, test } from "vitest";
import { mergeStoreDays, parseStoreExport, storeTotals } from "./store.ts";

// The dashboard's export as it comes, in the dashboard's language.
const EXPORT = `Установки
Дата,Установки
09.11.2026,0
10.11.2026,0
11.11.2026,17
12.11.2026,32
13.11.2026,26
`;

describe("parseStoreExport", () => {
  test("reads the daily installs, whatever the header's language", () => {
    expect(parseStoreExport(EXPORT)).toEqual([
      { date: "2026-11-09", installs: 0 },
      { date: "2026-11-10", installs: 0 },
      { date: "2026-11-11", installs: 17 },
      { date: "2026-11-12", installs: 32 },
      { date: "2026-11-13", installs: 26 },
    ]);
  });

  test("ISO dates, quotes, a byte-order mark and Windows line ends are fine", () => {
    const csv = '\uFEFFInstalls\r\nDate,Installs\r\n"2026-11-12","1,234"\r\n';
    expect(parseStoreExport(csv)).toEqual([
      { date: "2026-11-12", installs: 1234 },
    ]);
  });

  test("a file with no daily lines is not an export", () => {
    expect(() => parseStoreExport("Users\nDate,Users\n")).toThrow(
      /no daily installs/,
    );
  });

  test("a date it cannot read is an error, not a guess", () => {
    expect(() =>
      parseStoreExport("Installs\nDate,Installs\n11/12/2026,4\n"),
    ).toThrow(/11\/12\/2026/);
  });
});

describe("mergeStoreDays", () => {
  test("exports overlap; a day keeps its highest count (the last day may be partial)", () => {
    const merged = mergeStoreDays([
      [
        { date: "2026-11-12", installs: 32 },
        { date: "2026-11-13", installs: 10 },
      ],
      [
        { date: "2026-11-13", installs: 26 },
        { date: "2026-11-14", installs: 31 },
      ],
    ]);
    expect(merged).toEqual([
      { date: "2026-11-12", installs: 32 },
      { date: "2026-11-13", installs: 26 },
      { date: "2026-11-14", installs: 31 },
    ]);
  });
});

describe("storeTotals", () => {
  test("installs so far per day, from the first day with any", () => {
    expect(storeTotals(parseStoreExport(EXPORT))).toEqual([
      { date: "2026-11-11", value: 17 },
      { date: "2026-11-12", value: 49 },
      { date: "2026-11-13", value: 75 },
    ]);
  });

  test("nothing before the first install", () => {
    expect(storeTotals([{ date: "2026-11-01", installs: 0 }])).toEqual([]);
  });
});
