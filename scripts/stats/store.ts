// Chrome Web Store installs. The store has no API for them; the Developer
// Dashboard's Analytics exports a CSV of daily installs (a title line, a
// header in the dashboard's language, then "DD.MM.YYYY,count" lines). The
// owner uploads exports now and then into chrome-web-store/ on the stats
// branch; every run reads them all (render.ts). Pure, for the tests.
import type { Series } from "./series.ts";

export interface StoreDay {
  readonly date: string;
  readonly installs: number;
}

/** "DD.MM.YYYY" (the export's form) or ISO; anything else is ambiguous. */
function isoDate(text: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  return dotted ? `${dotted[3]}-${dotted[2]}-${dotted[1]}` : undefined;
}

const unquote = (field: string): string =>
  field.trim().replace(/^"(.*)"$/, "$1");

/** One line as a day, or undefined for the title and header lines. */
function dayOf(line: string): StoreDay | undefined {
  const comma = line.indexOf(",");
  if (comma < 0) return undefined;
  const first = unquote(line.slice(0, comma));
  const count = unquote(line.slice(comma + 1)).replace(/[\s,.\u00a0]/g, "");
  if (!/\d/.test(first)) return undefined;
  const date = isoDate(first);
  if (!date || !/^\d+$/.test(count)) {
    throw new Error(`Unreadable line in the store export: ${line}`);
  }
  return { date, installs: Number(count) };
}

export function parseStoreExport(csv: string): StoreDay[] {
  const days = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .flatMap((l) => dayOf(l) ?? []);
  if (!days.length) throw new Error("The file has no daily installs");
  return days;
}

/** Several exports as one list; an overlapping day keeps its highest count. */
export function mergeStoreDays(
  exports: readonly (readonly StoreDay[])[],
): StoreDay[] {
  const best = new Map<string, number>();
  for (const day of exports.flat()) {
    best.set(day.date, Math.max(best.get(day.date) ?? 0, day.installs));
  }
  return [...best]
    .map(([date, installs]) => ({ date, installs }))
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

/** Installs so far on each day, from the first day with any. */
export function storeTotals(days: readonly StoreDay[]): Series {
  const first = days.findIndex((d) => d.installs > 0);
  if (first < 0) return [];
  return days.slice(first).map((day, i, kept) => ({
    date: day.date,
    value: kept.slice(0, i + 1).reduce((sum, d) => sum + d.installs, 0),
  }));
}
