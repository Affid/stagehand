// Draws the charts and writes README.md from the CSV files in a folder (the
// stats branch): downloads.csv, traffic.csv and the Chrome Web Store exports
// in chrome-web-store/ (store.ts). Run by .github/workflows/stats.yml after
// snapshot.ts.
// Usage: node scripts/stats/render.ts <folder>
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPOSITORY } from "../release/companion-release.ts";
import { summaryCard } from "./card.ts";
import { lineChart } from "./chart.ts";
import {
  PRODUCT_NAMES,
  STORE_FOLDER,
  STORE_NAME,
  statsReadme,
} from "./readme.ts";
import {
  type DownloadLine,
  type Series,
  fromFirstVisit,
  latestDownloads,
  parseDownloads,
  parseTraffic,
  productTotals,
} from "./series.ts";
import {
  type StoreDay,
  mergeStoreDays,
  parseStoreExport,
  storeTotals,
} from "./store.ts";
import { THEMES, type Theme, formatDate } from "./svg.ts";

export const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}/stats`;

/** A thing counted on the card and the downloads chart. */
interface Entry {
  readonly name: string;
  readonly points: Series;
  /** Colour slot, fixed per thing so a missing one repaints none. */
  readonly slot: number;
}

const read = (file: string): string =>
  existsSync(file) ? readFileSync(file, "utf8") : "";

/** One export's days; an unreadable file is skipped with a workflow warning. */
function readExport(file: string): StoreDay[] {
  try {
    return parseStoreExport(read(file));
  } catch (e: unknown) {
    const why = e instanceof Error ? e.message : String(e);
    process.stdout.write(`::warning::Skipped ${file}: ${why}\n`);
    return [];
  }
}

function storeSeries(folder: string): Series {
  const dir = join(folder, STORE_FOLDER);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) =>
    f.toLowerCase().endsWith(".csv"),
  );
  return storeTotals(
    mergeStoreDays(files.map((f) => readExport(join(dir, f)))),
  );
}

function entries(lines: readonly DownloadLine[], store: Series): Entry[] {
  const totals = productTotals(lines);
  const all: readonly Entry[] = [
    { name: PRODUCT_NAMES.companion, points: totals.companion, slot: 0 },
    { name: STORE_NAME, points: store, slot: 3 },
    { name: PRODUCT_NAMES.extension, points: totals.extension, slot: 1 },
    { name: PRODUCT_NAMES.app, points: totals.app, slot: 2 },
  ];
  return all.filter((e) => e.points.length > 0);
}

function footnote(store: Series): string {
  const last = store.at(-1);
  return last
    ? `${STORE_NAME} installs as of ${formatDate(last.date)}, from its dashboard. The rest are GitHub release downloads.`
    : `Downloads from GitHub releases. ${STORE_NAME} installs are not counted.`;
}

function trafficChart(folder: string, theme: Theme): string | undefined {
  const traffic = fromFirstVisit(
    parseTraffic(read(join(folder, "traffic.csv"))),
  );
  if (!traffic.length) return undefined;
  return lineChart(
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
}

/** Every SVG for one theme, by file name without the theme suffix. */
function charts(
  folder: string,
  shown: readonly Entry[],
  store: Series,
  theme: Theme,
): ReadonlyMap<string, string> {
  const card = summaryCard(
    {
      title: "Stagehand downloads",
      footnote: footnote(store),
      tiles: shown.map((e) => ({ label: e.name, ...e })),
    },
    theme,
  );
  const downloads = lineChart(
    {
      title: "Downloads so far",
      subtitle:
        "Store installs and release file downloads of each part, day by day",
      lines: shown.map((e) => ({ ...e, legendValue: e.points.at(-1)?.value })),
    },
    theme,
  );
  const traffic = trafficChart(folder, theme);
  return new Map([
    ["card", card],
    ["downloads", downloads],
    ...(traffic ? [["traffic", traffic] as const] : []),
  ]);
}

function main(): void {
  const folder = process.argv[2];
  if (!folder) throw new Error("Usage: node scripts/stats/render.ts <folder>");
  const lines = parseDownloads(read(join(folder, "downloads.csv")));
  if (!lines.length) throw new Error(`No downloads.csv data in ${folder}`);
  const store = storeSeries(folder);
  const shown = entries(lines, store);
  const written = Object.values(THEMES).flatMap((theme) =>
    [...charts(folder, shown, store, theme)].map(([name, svg]) => {
      const file = `${name}-${theme.name}.svg`;
      writeFileSync(join(folder, file), svg);
      return file;
    }),
  );
  writeFileSync(
    join(folder, "README.md"),
    statsReadme({
      base: RAW_BASE,
      latest: latestDownloads(lines),
      hasTraffic: written.includes("traffic-light.svg"),
      store: store.at(-1),
    }),
  );
  process.stdout.write(`Wrote README.md, ${written.join(", ")}\n`);
}

try {
  main();
} catch (e: unknown) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
}
