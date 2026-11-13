import { describe, expect, test } from "vitest";
import {
  DOWNLOADS_HEADER,
  TRAFFIC_HEADER,
  downloadRows,
  mergeDownloads,
  mergeTraffic,
} from "./stats.ts";

const RELEASES = [
  {
    tag_name: "stagehand-v0.1.2",
    assets: [
      { name: "stagehand.zip", download_count: 20 },
      { name: "module.json", download_count: 46 },
    ],
  },
  {
    tag_name: "stagehand-extension-v0.3.1",
    assets: [{ name: "stagehand-extension-0.3.1.zip", download_count: 5 }],
  },
];

describe("downloadRows", () => {
  test("one row per release asset, sorted by tag then asset", () => {
    expect(downloadRows(RELEASES)).toEqual([
      {
        tag: "stagehand-extension-v0.3.1",
        asset: "stagehand-extension-0.3.1.zip",
        downloads: 5,
      },
      { tag: "stagehand-v0.1.2", asset: "module.json", downloads: 46 },
      { tag: "stagehand-v0.1.2", asset: "stagehand.zip", downloads: 20 },
    ]);
  });

  test("throws on an answer that is not a list of releases", () => {
    expect(() => downloadRows({ message: "Bad credentials" })).toThrow(
      /releases/,
    );
    expect(() => downloadRows([{ tag_name: "x", assets: [{}] }])).toThrow(
      /asset/,
    );
  });
});

describe("mergeDownloads", () => {
  const rows = downloadRows(RELEASES);

  test("a first snapshot starts the file with its header", () => {
    expect(mergeDownloads("", rows, "2026-11-13").split("\n")).toEqual([
      DOWNLOADS_HEADER,
      "2026-11-13,stagehand-extension-v0.3.1,stagehand-extension-0.3.1.zip,5",
      "2026-11-13,stagehand-v0.1.2,module.json,46",
      "2026-11-13,stagehand-v0.1.2,stagehand.zip,20",
      "",
    ]);
  });

  test("a later day is added; earlier days are kept", () => {
    const first = mergeDownloads("", rows, "2026-11-13");
    const next = mergeDownloads(
      first,
      [{ tag: "stagehand-v0.1.2", asset: "stagehand.zip", downloads: 23 }],
      "2026-11-14",
    );
    expect(next.split("\n")).toEqual([
      DOWNLOADS_HEADER,
      "2026-11-13,stagehand-extension-v0.3.1,stagehand-extension-0.3.1.zip,5",
      "2026-11-13,stagehand-v0.1.2,module.json,46",
      "2026-11-13,stagehand-v0.1.2,stagehand.zip,20",
      "2026-11-14,stagehand-v0.1.2,stagehand.zip,23",
      "",
    ]);
  });

  test("a second run on the same day replaces that day's rows", () => {
    const first = mergeDownloads("", rows, "2026-11-13");
    const again = mergeDownloads(
      first,
      [{ tag: "stagehand-v0.1.2", asset: "stagehand.zip", downloads: 21 }],
      "2026-11-13",
    );
    expect(again.split("\n")).toEqual([
      DOWNLOADS_HEADER,
      "2026-11-13,stagehand-v0.1.2,stagehand.zip,21",
      "",
    ]);
  });
});

const day = (date: string, count: number, uniques: number) => ({
  timestamp: `${date}T00:00:00Z`,
  count,
  uniques,
});

describe("mergeTraffic", () => {
  test("one line per day, views and clones side by side", () => {
    const csv = mergeTraffic(
      "",
      { views: [day("2026-11-12", 9, 4), day("2026-11-13", 3, 2)] },
      { clones: [day("2026-11-13", 7, 5)] },
    );
    expect(csv.split("\n")).toEqual([
      TRAFFIC_HEADER,
      "2026-11-12,9,4,0,0",
      "2026-11-13,3,2,7,5",
      "",
    ]);
  });

  test("keeps days older than GitHub's 14; a newer count for a day wins", () => {
    const old = [
      TRAFFIC_HEADER,
      "2026-10-01,5,5,1,1",
      "2026-11-13,3,2,7,5",
      "",
    ].join("\n");
    const csv = mergeTraffic(
      old,
      { views: [day("2026-11-13", 8, 6)] },
      { clones: [] },
    );
    expect(csv.split("\n")).toEqual([
      TRAFFIC_HEADER,
      "2026-10-01,5,5,1,1",
      "2026-11-13,8,6,0,0",
      "",
    ]);
  });

  test("throws on an answer without daily counts", () => {
    expect(() =>
      mergeTraffic("", { message: "Not Found" }, { clones: [] }),
    ).toThrow(/views/);
  });
});
