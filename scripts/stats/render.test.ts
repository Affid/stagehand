import { describe, expect, test } from "vitest";
import { change, summaryCard } from "./card.ts";
import { lineChart } from "./chart.ts";
import { picture, statsReadme } from "./readme.ts";
import { fromFirstVisit, parseDownloads } from "./series.ts";
import { THEMES, dateTicks, escapeXml, formatDate, niceTicks } from "./svg.ts";

const days = (...values: number[]) =>
  values.map((value, i) => ({
    date: `2026-11-${String(10 + i).padStart(2, "0")}`,
    value,
  }));

describe("scales", () => {
  test("round ticks from zero past the largest value", () => {
    expect(niceTicks(39)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(1234)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  test("evenly spaced dates, never more than the days there are", () => {
    expect(dateTicks("2026-11-13", "2026-11-13")).toEqual(["2026-11-13"]);
    expect(dateTicks("2026-11-13", "2026-11-14")).toEqual([
      "2026-11-13",
      "2026-11-14",
    ]);
    const month = dateTicks("2026-11-01", "2026-12-01");
    expect(month).toHaveLength(6);
    expect(month.at(-1)).toBe("2026-12-01");
  });

  test("dates read as month and day, with the year when asked", () => {
    expect(formatDate("2026-11-03")).toBe("Nov 3");
    expect(formatDate("2026-11-03", true)).toBe("Nov 3, 2026");
  });

  test("text is escaped for XML", () => {
    expect(escapeXml(`<a & "b">`)).toBe("&lt;a &amp; &quot;b&quot;&gt;");
  });
});

describe("change", () => {
  test("since the first count when there is under a week of history", () => {
    expect(change(days(27, 29, 35, 39))).toBe("+12 since Nov 10");
  });

  test("over the last seven days once there is more", () => {
    expect(change(days(1, 2, 3, 4, 5, 6, 7, 8, 10))).toBe("+8 in 7 days");
  });

  test("no change and a single day say so plainly", () => {
    expect(change(days(10, 10))).toBe("0 since Nov 10");
    expect(change(days(10))).toBeUndefined();
  });
});

describe("summaryCard", () => {
  test("one tile per part with its total, change and theme colours", () => {
    const svg = summaryCard(
      {
        title: "Stagehand downloads",
        footnote: "From GitHub releases.",
        tiles: [
          { label: "Companion module", points: days(27, 39) },
          { label: "Android app", points: days(10) },
        ],
      },
      THEMES.dark,
    );
    expect(svg).toContain(">Companion module</text>");
    expect(svg).toContain(">39</text>");
    expect(svg).toContain(">+12 since Nov 10</text>");
    expect(svg).toContain(">counting since Nov 10</text>");
    expect(svg).toContain(">Updated Nov 11, 2026</text>");
    expect(svg).toContain(THEMES.dark.surface);
    expect(svg).not.toContain(THEMES.light.surface);
  });
});

describe("lineChart", () => {
  test("a line and an end dot per series, a legend naming each", () => {
    const svg = lineChart(
      {
        title: "Downloads so far",
        subtitle: "Day by day",
        lines: [
          { name: "Extension", points: days(16, 18), legendValue: 18 },
          { name: "Android app", points: days(10, 10) },
        ],
      },
      THEMES.light,
    );
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg.match(/<circle /g)).toHaveLength(2);
    expect(svg).toContain(">Extension<tspan");
    expect(svg).toContain(">18</tspan></text>");
    expect(svg).toContain(">Android app</text>");
    expect(svg).toContain(">Nov 10, 2026</text>");
    expect(svg).toContain('aria-label="Downloads so far. Day by day"');
  });

  test("a single day is drawn as dots in the middle", () => {
    const svg = lineChart(
      {
        title: "T",
        subtitle: "S",
        lines: [{ name: "A", points: days(5) }],
        width: 400,
      },
      THEMES.light,
    );
    expect(svg).toMatch(/<circle cx="2\d\d(\.\d)?"/);
  });
});

describe("fromFirstVisit", () => {
  const day = (date: string, views: number) => ({
    date,
    views,
    viewUniques: views,
    clones: 0,
    cloneUniques: 0,
  });

  test("drops the quiet days before the first visit", () => {
    const kept = fromFirstVisit([
      day("2026-11-01", 0),
      day("2026-11-02", 3),
      day("2026-11-03", 0),
    ]);
    expect(kept.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  test("nothing when nobody visited", () => {
    expect(fromFirstVisit([day("2026-11-01", 0)])).toEqual([]);
  });
});

describe("statsReadme", () => {
  const latest = parseDownloads(`date,tag,asset,downloads
2026-11-16,stagehand-v0.1.2,module.json,80
2026-11-16,stagehand-v0.1.2,stagehand.zip,25
2026-11-16,stagehand-extension-v0.3.2,stagehand-extension-0.3.2.zip,4
`);

  test("charts follow the GitHub theme through <picture>", () => {
    expect(picture("https://x/stats", "card", "Totals")).toContain(
      'srcset="https://x/stats/card-dark.svg"',
    );
  });

  test("totals per part, every file, and the traffic chart only with data", () => {
    const withTraffic = statsReadme({
      base: "https://x/stats",
      latest,
      hasTraffic: true,
    });
    expect(withTraffic).toContain("Last snapshot: Nov 16, 2026.");
    expect(withTraffic).toContain("| Companion module | 25 |");
    expect(withTraffic).toContain("| Foundry lookups | 80 |");
    expect(withTraffic).toContain("| Android app | 0 |");
    expect(withTraffic).toContain("| stagehand-v0.1.2 | module.json | 80 |");
    expect(withTraffic).toContain("traffic-light.svg");
    const without = statsReadme({
      base: "https://x/stats",
      latest,
      hasTraffic: false,
    });
    expect(without).not.toContain("traffic-light.svg");
  });

  test("the store's total and last export day when there are exports", () => {
    const readme = statsReadme({
      base: "https://x/stats",
      latest,
      hasTraffic: false,
      store: { date: "2026-11-15", value: 135 },
    });
    expect(readme).toContain("| Chrome Web Store | 135 |");
    expect(readme).toContain("Last export day: Nov 15, 2026.");
    expect(
      statsReadme({ base: "https://x", latest, hasTraffic: false }),
    ).not.toContain("| Chrome Web Store |");
  });
});

describe("colour slots", () => {
  test("a line keeps its slot's colour whatever its place", () => {
    const svg = lineChart(
      {
        title: "T",
        subtitle: "S",
        lines: [{ name: "App", points: days(1, 2), slot: 2 }],
      },
      THEMES.light,
    );
    expect(svg).toContain(`stroke="${THEMES.light.series[2]}"`);
    expect(svg).not.toContain(`stroke="${THEMES.light.series[0]}"`);
  });
});
