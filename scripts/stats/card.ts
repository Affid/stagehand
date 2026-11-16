// The summary card: one tile per product with its total so far, the change
// over the last week and a small trend line. Made for the main README.
import type { Series } from "./series.ts";
import {
  type Theme,
  dayNumber,
  endDot,
  formatCount,
  formatDate,
  frame,
  polyline,
  text,
} from "./svg.ts";

export interface Tile {
  readonly label: string;
  readonly points: Series;
  /** Colour slot, the same as the thing's line in the charts. */
  readonly slot?: number;
}

export interface CardSpec {
  readonly title: string;
  readonly footnote: string;
  readonly tiles: readonly Tile[];
  readonly width?: number;
}

const PAD = 24;
const GAP = 16;
const HEIGHT = 178;
const WEEK = 7;
const SPARK_DAYS = 30;
/** Where the trend line starts in a tile, as a share of its width. */
const SPARK_SHARE = 0.5;
const SPARK_MIN = 92;
const SPARK_MAX = 116;

/** "+5 in 7 days", or since the first count when there is less history. */
export function change(points: Series): string | undefined {
  const last = points.at(-1);
  if (!last || points.length < 2) return undefined;
  const since = dayNumber(last.date) - WEEK;
  const from = points.find((p) => dayNumber(p.date) >= since) ?? last;
  const base = from === last ? (points.at(-2) ?? last) : from;
  const diff = last.value - base.value;
  const sign = diff > 0 ? "+" : "";
  const period =
    dayNumber(base.date) === since
      ? `in ${WEEK} days`
      : `since ${formatDate(base.date)}`;
  return `${sign}${formatCount(diff)} ${period}`;
}

function sparkline(
  points: Series,
  box: { x: number; y: number; w: number; h: number },
  color: string,
  theme: Theme,
): string[] {
  const recent = points.slice(-SPARK_DAYS);
  const last = recent.at(-1);
  if (!last) return [];
  const values = recent.map((p) => p.value);
  const low = Math.min(...values);
  const range = Math.max(...values) - low || 1;
  const first = dayNumber(recent[0]?.date ?? last.date);
  const span = dayNumber(last.date) - first || 1;
  const xy = recent.map(
    (p) =>
      [
        box.x + ((dayNumber(p.date) - first) / span) * box.w,
        box.y + box.h - ((p.value - low) / range) * box.h,
      ] as const,
  );
  const end = xy.at(-1) ?? [box.x + box.w, box.y + box.h];
  return [
    ...(xy.length > 1 ? [polyline(xy, theme.spark, 1.5)] : []),
    endDot(end[0], end[1], color, theme),
  ];
}

function tile(
  t: Tile,
  x: number,
  width: number,
  color: string,
  theme: Theme,
): string[] {
  const last = t.points.at(-1);
  const delta = change(t.points);
  const first = t.points[0];
  const note =
    delta ?? (first ? `counting since ${formatDate(first.date)}` : "no data");
  const grew = delta?.startsWith("+") ?? false;
  const offset = Math.min(SPARK_MAX, Math.max(SPARK_MIN, width * SPARK_SHARE));
  return [
    `<line x1="${x}" x2="${x + 14}" y1="64" y2="64" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`,
    text(x + 20, 68, t.label, { size: 12, fill: theme.secondary }),
    text(x, 106, formatCount(last?.value ?? 0), {
      size: 30,
      weight: 600,
      fill: theme.primary,
    }),
    text(x, 128, note, { size: 12, fill: grew ? theme.good : theme.muted }),
    ...sparkline(
      t.points,
      { x: x + offset, y: 82, w: width - offset - 8, h: 26 },
      color,
      theme,
    ),
  ];
}

export function summaryCard(spec: CardSpec, theme: Theme): string {
  const width = spec.width ?? 800;
  const count = Math.max(spec.tiles.length, 1);
  const tileWidth = (width - 2 * PAD - (count - 1) * GAP) / count;
  const updated = spec.tiles[0]?.points.at(-1)?.date;
  return frame(width, HEIGHT, spec.title, theme, [
    text(PAD, 34, spec.title, { size: 14, weight: 600, fill: theme.primary }),
    ...(updated
      ? [
          text(width - PAD, 34, `Updated ${formatDate(updated, true)}`, {
            size: 12,
            fill: theme.muted,
            anchor: "end",
          }),
        ]
      : []),
    ...spec.tiles.flatMap((t, i) =>
      tile(
        t,
        PAD + i * (tileWidth + GAP),
        tileWidth,
        theme.series[t.slot ?? i] ?? theme.spark,
        theme,
      ),
    ),
    text(PAD, HEIGHT - 16, spec.footnote, { size: 11, fill: theme.muted }),
  ]);
}
