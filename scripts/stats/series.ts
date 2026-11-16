// The stats branch's CSV files (stats.ts) read back as the day-by-day series
// the charts draw (render.ts). Pure, for the tests.
import { dataLines } from "./stats.ts";

/** What a release file stands for: who downloads it, and why. */
export type Product = "companion" | "lookups" | "extension" | "app";

export const PRODUCTS: readonly Product[] = [
  "companion",
  "extension",
  "app",
  "lookups",
];

export function productOf(asset: string): Product | undefined {
  if (asset === "stagehand.zip") return "companion";
  if (asset === "module.json") return "lookups";
  if (/^stagehand-extension-.+\.zip$/.test(asset)) return "extension";
  if (asset.endsWith(".apk")) return "app";
  return undefined;
}

export interface Point {
  readonly date: string;
  readonly value: number;
}

export type Series = readonly Point[];

export interface DownloadLine {
  readonly date: string;
  readonly tag: string;
  readonly asset: string;
  readonly downloads: number;
}

export interface TrafficDay {
  readonly date: string;
  readonly views: number;
  readonly viewUniques: number;
  readonly clones: number;
  readonly cloneUniques: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COUNT = /^\d+$/;

/** A CSV line split into fields, checked: a date, then `counts` numbers last. */
function fields(
  line: string,
  size: number,
  counts: number,
  what: string,
): readonly string[] {
  const parts = line.split(",");
  const valid =
    parts.length === size &&
    DATE.test(parts[0] ?? "") &&
    parts.slice(size - counts).every((p) => COUNT.test(p));
  if (!valid) throw new Error(`Unexpected ${what} line: ${line}`);
  return parts;
}

export function parseDownloads(csv: string): DownloadLine[] {
  return dataLines(csv).map((line) => {
    const [date, tag, asset, downloads] = fields(line, 4, 1, "downloads");
    return {
      date: date ?? "",
      tag: tag ?? "",
      asset: asset ?? "",
      downloads: Number(downloads),
    };
  });
}

export function parseTraffic(csv: string): TrafficDay[] {
  return dataLines(csv).map((line) => {
    const [date, ...counts] = fields(line, 5, 4, "traffic");
    const [views, viewUniques, clones, cloneUniques] = counts.map(Number);
    return {
      date: date ?? "",
      views: views ?? 0,
      viewUniques: viewUniques ?? 0,
      clones: clones ?? 0,
      cloneUniques: cloneUniques ?? 0,
    };
  });
}

const datesOf = (lines: readonly DownloadLine[]): string[] =>
  [...new Set(lines.map((l) => l.date))].toSorted();

/** Each product's total downloads so far, one point per snapshot day. */
export function productTotals(
  lines: readonly DownloadLine[],
): Readonly<Record<Product, Series>> {
  const dates = datesOf(lines);
  const total = (product: Product, date: string): number =>
    lines
      .filter((l) => l.date === date && productOf(l.asset) === product)
      .reduce((sum, l) => sum + l.downloads, 0);
  const series = (product: Product): Series =>
    dates.map((date) => ({ date, value: total(product, date) }));
  return {
    companion: series("companion"),
    lookups: series("lookups"),
    extension: series("extension"),
    app: series("app"),
  };
}

/** The lines of the newest snapshot. */
export function latestDownloads(
  lines: readonly DownloadLine[],
): DownloadLine[] {
  const last = datesOf(lines).at(-1);
  return lines.filter((l) => l.date === last);
}

/** The days from the first one with any traffic on, so a quiet start is not drawn. */
export function fromFirstVisit(days: readonly TrafficDay[]): TrafficDay[] {
  const first = days.findIndex((d) => d.views + d.clones > 0);
  return first < 0 ? [] : days.slice(first);
}
