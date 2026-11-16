import { describe, expect, test } from "vitest";
import {
  latestDownloads,
  parseDownloads,
  parseTraffic,
  productOf,
  productTotals,
} from "./series.ts";

const DOWNLOADS = `date,tag,asset,downloads
2026-11-13,stagehand-app-v0.3.2,stagehand-0.3.2.apk,2
2026-11-13,stagehand-extension-v0.3.1,stagehand-extension-0.3.1.zip,5
2026-11-13,stagehand-extension-v0.3.2,stagehand-extension-0.3.2.zip,3
2026-11-13,stagehand-v0.1.2,module.json,46
2026-11-13,stagehand-v0.1.2,stagehand.zip,20
2026-11-14,stagehand-app-v0.3.2,stagehand-0.3.2.apk,2
2026-11-14,stagehand-extension-v0.3.1,stagehand-extension-0.3.1.zip,5
2026-11-14,stagehand-extension-v0.3.2,stagehand-extension-0.3.2.zip,4
2026-11-14,stagehand-v0.1.2,module.json,71
2026-11-14,stagehand-v0.1.2,stagehand.zip,22
`;

describe("productOf", () => {
  test("tells the release files apart by name", () => {
    expect(productOf("stagehand.zip")).toBe("companion");
    expect(productOf("module.json")).toBe("lookups");
    expect(productOf("stagehand-extension-0.3.2.zip")).toBe("extension");
    expect(productOf("stagehand-0.3.2.apk")).toBe("app");
    expect(productOf("notes.txt")).toBeUndefined();
  });
});

describe("parseDownloads", () => {
  test("reads one line per file per day", () => {
    const lines = parseDownloads(DOWNLOADS);
    expect(lines).toHaveLength(10);
    expect(lines[0]).toEqual({
      date: "2026-11-13",
      tag: "stagehand-app-v0.3.2",
      asset: "stagehand-0.3.2.apk",
      downloads: 2,
    });
  });

  test("an empty file has no lines", () => {
    expect(parseDownloads("")).toEqual([]);
  });

  test("rejects a malformed line", () => {
    expect(() =>
      parseDownloads("date,tag,asset,downloads\n2026-11-13,x,y,many\n"),
    ).toThrow(/downloads line/);
  });
});

describe("productTotals", () => {
  test("sums each product's files per day, every day for every product", () => {
    const totals = productTotals(parseDownloads(DOWNLOADS));
    expect(totals.extension).toEqual([
      { date: "2026-11-13", value: 8 },
      { date: "2026-11-14", value: 9 },
    ]);
    expect(totals.companion.map((p) => p.value)).toEqual([20, 22]);
    expect(totals.lookups.map((p) => p.value)).toEqual([46, 71]);
    expect(totals.app.map((p) => p.value)).toEqual([2, 2]);
  });

  test("a product with no file yet counts zero that day", () => {
    const totals = productTotals(
      parseDownloads(
        "date,tag,asset,downloads\n2026-11-13,stagehand-v0.1.2,stagehand.zip,1\n",
      ),
    );
    expect(totals.app).toEqual([{ date: "2026-11-13", value: 0 }]);
  });
});

describe("latestDownloads", () => {
  test("only the last day's lines", () => {
    const latest = latestDownloads(parseDownloads(DOWNLOADS));
    expect(latest).toHaveLength(5);
    expect(latest.every((l) => l.date === "2026-11-14")).toBe(true);
  });

  test("nothing for an empty file", () => {
    expect(latestDownloads([])).toEqual([]);
  });
});

describe("parseTraffic", () => {
  test("reads views and clones per day", () => {
    const days = parseTraffic(
      "date,views,view_uniques,clones,clone_uniques\n2026-11-12,43,28,86,38\n",
    );
    expect(days).toEqual([
      {
        date: "2026-11-12",
        views: 43,
        viewUniques: 28,
        clones: 86,
        cloneUniques: 38,
      },
    ]);
  });

  test("rejects a malformed line", () => {
    expect(() =>
      parseTraffic("date,views,view_uniques,clones,clone_uniques\n2026,1,2\n"),
    ).toThrow(/traffic line/);
  });
});
