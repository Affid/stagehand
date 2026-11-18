// A line chart over days, for the stats branch's README: one axis, a legend
// naming every line (with its latest value when asked), hairline grid.
import type { Series } from "./series.ts";
import {
  type Theme,
  dateTicks,
  dayNumber,
  endDot,
  escapeXml,
  formatCount,
  formatDate,
  frame,
  niceTicks,
  polyline,
  round,
  text,
  textWidth,
} from "./svg.ts";

export interface Line {
  readonly name: string;
  readonly points: Series;
  /** Colour slot; fixed per thing counted, so a missing line repaints none. */
  readonly slot?: number;
  /** Shown after the name in the legend, e.g. the latest total. */
  readonly legendValue?: number | undefined;
}

export interface ChartSpec {
  readonly title: string;
  readonly subtitle: string;
  readonly lines: readonly Line[];
  readonly width?: number;
  readonly height?: number;
}

const PAD = 24;
const PLOT_TOP = 104;
const PLOT_BOTTOM_GAP = 36;
const LEGEND_Y = 82;
const LEGEND_GAP = 24;
const KEY = 14;
const TICK_SIZE = 11;

interface Plot {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly x: (date: string) => number;
  readonly y: (value: number) => number;
  readonly ticks: readonly number[];
}

function plotArea(spec: ChartSpec, width: number, height: number): Plot {
  const all = spec.lines.flatMap((l) => l.points);
  const ticks = niceTicks(Math.max(0, ...all.map((p) => p.value)));
  const widest = Math.max(
    ...ticks.map((t) => textWidth(formatCount(t), TICK_SIZE)),
  );
  const left = PAD + widest + 8;
  const right = width - PAD - 8;
  const top = PLOT_TOP;
  const bottom = height - PLOT_BOTTOM_GAP;
  const days = all.map((p) => dayNumber(p.date));
  const first = Math.min(...days);
  const span = Math.max(...days) - first;
  const yTop = ticks.at(-1) ?? 1;
  return {
    left,
    right,
    top,
    bottom,
    ticks,
    x: (date) =>
      span === 0
        ? (left + right) / 2
        : left + ((dayNumber(date) - first) / span) * (right - left),
    y: (value) => bottom - (value / yTop) * (bottom - top),
  };
}

function grid(plot: Plot, theme: Theme): string[] {
  return plot.ticks.flatMap((tick) => {
    const y = plot.y(tick);
    const color = tick === 0 ? theme.axis : theme.grid;
    return [
      `<line x1="${plot.left}" x2="${plot.right}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="1"/>`,
      text(plot.left - 8, y + 4, formatCount(tick), {
        size: TICK_SIZE,
        fill: theme.muted,
        anchor: "end",
      }),
    ];
  });
}

function xLabels(plot: Plot, dates: readonly string[], theme: Theme): string[] {
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return [];
  const ticks = dateTicks(first, last);
  return ticks.map((date, i) => {
    const year = date.slice(0, 4);
    const withYear = i === 0 || ticks[i - 1]?.slice(0, 4) !== year;
    const anchor =
      ticks.length === 1
        ? "middle"
        : i === 0
          ? "start"
          : i === ticks.length - 1
            ? "end"
            : "middle";
    return text(plot.x(date), plot.bottom + 22, formatDate(date, withYear), {
      size: TICK_SIZE,
      fill: theme.muted,
      anchor,
    });
  });
}

/** A legend entry's label: the name, then its value in bold, placed by the browser. */
function legendLabel(line: Line, x: number, theme: Theme): string {
  const value =
    line.legendValue === undefined
      ? ""
      : `<tspan dx="6" font-weight="600" fill="${theme.primary}">${formatCount(line.legendValue)}</tspan>`;
  return `<text x="${x}" y="${LEGEND_Y}" font-size="12" fill="${theme.secondary}">${escapeXml(line.name)}${value}</text>`;
}

const legendWidth = (line: Line): number =>
  KEY +
  6 +
  textWidth(line.name, 12) +
  (line.legendValue === undefined
    ? 0
    : 6 + textWidth(formatCount(line.legendValue), 12)) +
  LEGEND_GAP;

function legend(lines: readonly Line[], theme: Theme): string[] {
  const starts = lines.map((_, i) =>
    lines.slice(0, i).reduce((x, l) => x + legendWidth(l), PAD),
  );
  return lines.flatMap((line, i) => {
    const color = theme.series[line.slot ?? i] ?? theme.spark;
    const at = starts[i] ?? PAD;
    return [
      `<line x1="${round(at)}" x2="${round(at + KEY)}" y1="${LEGEND_Y - 4}" y2="${LEGEND_Y - 4}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`,
      legendLabel(line, round(at + KEY + 6), theme),
    ];
  });
}

function marks(lines: readonly Line[], plot: Plot, theme: Theme): string[] {
  return lines.flatMap((line, i) => {
    const color = theme.series[line.slot ?? i] ?? theme.spark;
    const points = line.points.map(
      (p) => [plot.x(p.date), plot.y(p.value)] as const,
    );
    const last = points.at(-1);
    if (!last) return [];
    return [polyline(points, color, 2), endDot(last[0], last[1], color, theme)];
  });
}

export function lineChart(spec: ChartSpec, theme: Theme): string {
  const width = spec.width ?? 800;
  const height = spec.height ?? 300;
  const plot = plotArea(spec, width, height);
  const dates = [
    ...new Set(spec.lines.flatMap((l) => l.points.map((p) => p.date))),
  ].toSorted();
  return frame(width, height, `${spec.title}. ${spec.subtitle}`, theme, [
    text(PAD, 38, spec.title, { size: 16, weight: 600, fill: theme.primary }),
    text(PAD, 58, spec.subtitle, { size: 12, fill: theme.secondary }),
    ...legend(spec.lines, theme),
    ...grid(plot, theme),
    ...xLabels(plot, dates, theme),
    ...marks(spec.lines, plot, theme),
  ]);
}
