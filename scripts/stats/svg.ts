// Shared pieces of the stats charts (chart.ts, card.ts): themes, scales and
// SVG text. The SVGs are shown as images in READMEs, where GitHub runs no
// scripts, so they are static; light and dark are separate files picked by
// a <picture> element, which follows the viewer's GitHub theme.

export type ThemeName = "light" | "dark";

export interface Theme {
  readonly name: ThemeName;
  readonly surface: string;
  readonly border: string;
  readonly primary: string;
  readonly secondary: string;
  readonly muted: string;
  readonly grid: string;
  readonly axis: string;
  readonly spark: string;
  readonly good: string;
  /** Categorical slots in fixed order, checked for colour-blind separation. */
  readonly series: readonly [string, string, string];
}

// Surfaces are GitHub's own page colours, so the card sits flush in a README.
export const THEMES: Readonly<Record<ThemeName, Theme>> = {
  light: {
    name: "light",
    surface: "#ffffff",
    border: "#d1d9e0",
    primary: "#1f2328",
    secondary: "#59636e",
    muted: "#6e7781",
    grid: "#eaeef2",
    axis: "#c8d1da",
    spark: "#8c959f",
    good: "#1a7f37",
    series: ["#2a78d6", "#eb6834", "#1baf7a"],
  },
  dark: {
    name: "dark",
    surface: "#0d1117",
    border: "#3d444d",
    primary: "#f0f6fc",
    secondary: "#9198a1",
    muted: "#9198a1",
    grid: "#21262d",
    axis: "#3d444d",
    spark: "#656c76",
    good: "#3fb950",
    series: ["#3987e5", "#d95926", "#199e70"],
  },
};

export const FONT = `system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
const DAY_MS = 86_400_000;
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
/** Average glyph width as a share of the font size, for laying out text. */
const GLYPH = 0.6;

export const escapeXml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Roughly how wide a line of text renders; good enough to place things. */
export const textWidth = (text: string, size: number): number =>
  text.length * size * GLYPH;

export const formatCount = (n: number): string => n.toLocaleString("en-US");

export const dayNumber = (date: string): number =>
  Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

const dateOfDay = (day: number): string =>
  new Date(day * DAY_MS).toISOString().slice(0, 10);

/** "Nov 13", or "Nov 13, 2026" when the year should be said. */
export function formatDate(date: string, withYear = false): string {
  const [year, month, day] = date.split("-");
  const label = `${MONTHS[Number(month) - 1]} ${Number(day)}`;
  return withYear ? `${label}, ${year}` : label;
}

/** Round axis steps (1, 2, 5 x 10^n, whole numbers) from zero past `max`. */
export function niceTicks(max: number, most = 4): number[] {
  const top = Math.max(max, 1);
  const rough = Math.max(top / most, 1);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? power * 10;
  const count = Math.ceil(top / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

/** Up to `most` evenly spaced days from first to last, as dates. */
export function dateTicks(first: string, last: string, most = 6): string[] {
  const from = dayNumber(first);
  const span = dayNumber(last) - from;
  const count = Math.min(most, span + 1);
  if (count <= 1) return [first];
  const days = Array.from({ length: count }, (_, i) =>
    Math.round(from + (i * span) / (count - 1)),
  );
  return [...new Set(days)].map(dateOfDay);
}

export interface TextOptions {
  readonly size: number;
  readonly fill: string;
  readonly weight?: number;
  readonly anchor?: "start" | "middle" | "end";
}

export function text(
  x: number,
  y: number,
  content: string,
  options: TextOptions,
): string {
  const weight = options.weight ? ` font-weight="${options.weight}"` : "";
  const anchor =
    options.anchor && options.anchor !== "start"
      ? ` text-anchor="${options.anchor}"`
      : "";
  return `<text x="${round(x)}" y="${round(y)}" font-size="${options.size}" fill="${options.fill}"${weight}${anchor}>${escapeXml(content)}</text>`;
}

export const round = (n: number): number => Math.round(n * 10) / 10;

/** The outer frame: a rounded card with an accessible title. */
export function frame(
  width: number,
  height: number,
  label: string,
  theme: Theme,
  body: readonly string[],
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}" font-family='${FONT}'>`,
    `<title>${escapeXml(label)}</title>`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="6" fill="${theme.surface}" stroke="${theme.border}"/>`,
    ...body,
    `</svg>`,
    "",
  ].join("\n");
}

/** A dot with a ring in the surface colour, so it reads over lines. */
export const endDot = (
  x: number,
  y: number,
  color: string,
  theme: Theme,
): string =>
  `<circle cx="${round(x)}" cy="${round(y)}" r="4" fill="${color}" stroke="${theme.surface}" stroke-width="2"/>`;

export const polyline = (
  points: readonly (readonly [number, number])[],
  color: string,
  width: number,
): string =>
  `<path d="${points.map(([x, y], i) => `${i ? "L" : "M"}${round(x)} ${round(y)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
