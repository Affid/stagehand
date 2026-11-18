// The stats branch's README.md: the charts, the latest totals and what each
// count means. Images use raw URLs on the branch, the same ones the main
// README's card uses, so both show the same files.
import {
  type DownloadLine,
  PRODUCTS,
  type Point,
  type Product,
  productOf,
} from "./series.ts";
import { formatCount, formatDate } from "./svg.ts";

export const PRODUCT_NAMES: Readonly<Record<Product, string>> = {
  companion: "Companion module",
  extension: "Extension zip",
  app: "Android app",
  lookups: "Foundry lookups",
};

const MEANINGS: Readonly<Record<Product, string>> = {
  companion:
    "`stagehand.zip` downloads: the companion module installed or updated by Foundry.",
  extension:
    "The extension's zip from the releases, for people who load it unpacked.",
  app: "The APK from the releases, sideloaded.",
  lookups:
    "`module.json` downloads: Foundry reading the release manifest through the foundryvtt.com listing. These are lookups, not installs.",
};

/** A chart shown in the viewer's GitHub theme. */
export const picture = (base: string, name: string, alt: string): string =>
  [
    "<picture>",
    `  <source media="(prefers-color-scheme: dark)" srcset="${base}/${name}-dark.svg">`,
    `  <img alt="${alt}" src="${base}/${name}-light.svg">`,
    "</picture>",
  ].join("\n");

export interface ReadmeSpec {
  /** Raw URL of the stats branch, without a trailing slash. */
  readonly base: string;
  readonly latest: readonly DownloadLine[];
  readonly hasTraffic: boolean;
  /** Chrome Web Store installs so far, when there are exports. */
  readonly store?: Point | undefined;
}

export const STORE_NAME = "Chrome Web Store";
export const STORE_FOLDER = "chrome-web-store";

const storeRow = (store: Point): string =>
  `| ${STORE_NAME} | ${formatCount(store.value)} | Installs from the store, summed from the daily counts in its Developer Dashboard exports (\`${STORE_FOLDER}/\`). Last export day: ${formatDate(store.date, true)}. |`;

function totalsTable(
  latest: readonly DownloadLine[],
  store: Point | undefined,
): string[] {
  const total = (p: Product): number =>
    latest
      .filter((l) => productOf(l.asset) === p)
      .reduce((s, l) => s + l.downloads, 0);
  return [
    "| | Downloads so far | What it counts |",
    "| --- | ---: | --- |",
    ...(store ? [storeRow(store)] : []),
    ...PRODUCTS.map(
      (p) =>
        `| ${PRODUCT_NAMES[p]} | ${formatCount(total(p))} | ${MEANINGS[p]} |`,
    ),
  ];
}

function filesTable(latest: readonly DownloadLine[]): string[] {
  return [
    "<details>",
    "<summary>Every release file</summary>",
    "",
    "| Release | File | Downloads |",
    "| --- | --- | ---: |",
    ...latest
      .toSorted(
        (a, b) => b.tag.localeCompare(a.tag) || a.asset.localeCompare(b.asset),
      )
      .map((l) => `| ${l.tag} | ${l.asset} | ${formatCount(l.downloads)} |`),
    "",
    "</details>",
  ];
}

export function statsReadme(spec: ReadmeSpec): string {
  const date = spec.latest[0]?.date;
  const updated = date ? ` Last snapshot: ${formatDate(date, true)}.` : "";
  return [
    "# Stagehand download counts",
    "",
    `Written once a day by the Download counts workflow (\`.github/workflows/stats.yml\` on \`main\`).${updated} Do not edit by hand: the next run replaces this file and the charts.`,
    "",
    picture(spec.base, "card", "Downloads so far, by part"),
    "",
    picture(spec.base, "downloads", "Downloads so far, day by day"),
    "",
    ...(spec.hasTraffic
      ? [picture(spec.base, "traffic", "Repository visitors per day"), ""]
      : []),
    "## Totals",
    "",
    ...totalsTable(spec.latest, spec.store),
    "",
    ...filesTable(spec.latest),
    "",
    "## Data",
    "",
    "- [`downloads.csv`](downloads.csv): every release file's total, once a day. The difference between two days is that day's downloads.",
    "- [`traffic.csv`](traffic.csv): GitHub's views and clones per day, with unique visitors. GitHub keeps only 14 days; this keeps them all. Referrers are not saved: they name people's own Foundry servers.",
    `- [\`${STORE_FOLDER}/\`](${STORE_FOLDER}): CSV exports of daily installs from the Chrome Web Store Developer Dashboard (Analytics, Installs, Export), uploaded by hand; the store has no API for them. To add one, open that folder on GitHub, choose Add file, Upload files, and commit to \`stats\`. The next daily run counts it, or run the Download counts workflow by hand. Exports may overlap; each day keeps its highest count.`,
    "",
  ].join("\n");
}
