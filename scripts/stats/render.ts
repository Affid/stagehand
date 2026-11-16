// Draws the charts and writes README.md from the CSV files in a folder (the
// stats branch). Run by .github/workflows/stats.yml after snapshot.ts.
// Usage: node scripts/stats/render.ts <folder>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPOSITORY } from "../release/companion-release.ts";
import { summaryCard } from "./card.ts";
import { lineChart } from "./chart.ts";
import { PRODUCT_NAMES, statsReadme } from "./readme.ts";
import {
  type Product,
  fromFirstVisit,
  latestDownloads,
  parseDownloads,
  parseTraffic,
  productTotals,
} from "./series.ts";
import { THEMES, type Theme } from "./svg.ts";

export const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}/stats`;
const SHOWN: readonly Product[] = ["companion", "extension", "app"];
const FOOTNOTE =
  "Downloads from GitHub releases. Chrome Web Store installs are not counted.";

const read = (file: string): string =>
  existsSync(file) ? readFileSync(file, "utf8") : "";

/** Every SVG for one theme, by file name without the theme suffix. */
function charts(folder: string, theme: Theme): ReadonlyMap<string, string> {
  const lines = parseDownloads(read(join(folder, "downloads.csv")));
  const totals = productTotals(lines);
  const traffic = fromFirstVisit(
    parseTraffic(read(join(folder, "traffic.csv"))),
  );
  const card = summaryCard(
    {
      title: "Stagehand downloads",
      footnote: FOOTNOTE,
      tiles: SHOWN.map((p) => ({ label: PRODUCT_NAMES[p], points: totals[p] })),
    },
    theme,
  );
  const downloads = lineChart(
    {
      title: "Downloads so far",
      subtitle: "Total downloads of each part's release files, day by day",
      lines: SHOWN.map((p) => ({
        name: PRODUCT_NAMES[p],
        points: totals[p],
        legendValue: totals[p].at(-1)?.value,
      })),
    },
    theme,
  );
  const visitors = lineChart(
    {
      title: "Repository visitors",
      subtitle:
        "Unique visitors and unique cloners per day, from GitHub traffic",
      lines: [
        {
          name: "Visitors",
          points: traffic.map((d) => ({ date: d.date, value: d.viewUniques })),
        },
        {
          name: "Cloners",
          points: traffic.map((d) => ({ date: d.date, value: d.cloneUniques })),
        },
      ],
    },
    theme,
  );
  return new Map([
    ["card", card],
    ["downloads", downloads],
    ...(traffic.length ? [["traffic", visitors] as const] : []),
  ]);
}

function main(): void {
  const folder = process.argv[2];
  if (!folder) throw new Error("Usage: node scripts/stats/render.ts <folder>");
  const lines = parseDownloads(read(join(folder, "downloads.csv")));
  if (!lines.length) throw new Error(`No downloads.csv data in ${folder}`);
  const written = Object.values(THEMES).flatMap((theme) =>
    [...charts(folder, theme)].map(([name, svg]) => {
      const file = `${name}-${theme.name}.svg`;
      writeFileSync(join(folder, file), svg);
      return file;
    }),
  );
  const hasTraffic = written.includes("traffic-light.svg");
  writeFileSync(
    join(folder, "README.md"),
    statsReadme({ base: RAW_BASE, latest: latestDownloads(lines), hasTraffic }),
  );
  process.stdout.write(`Wrote README.md, ${written.join(", ")}\n`);
}

try {
  main();
} catch (e: unknown) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
}
