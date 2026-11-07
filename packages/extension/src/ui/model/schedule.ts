// The next-session schedule (SETUP-REDESIGN.md, Next session): ours, kept in
// the world's flags. Foundry keeps one nextSession; we move it to the next
// date here once a session has passed. Pure: "now" is always passed in.

export type Freq = "none" | "w1" | "w2" | "m1" | "dates";

export interface Schedule {
  /** The first date, "2026-11-10" (ignored for chosen dates). */
  readonly start: string;
  /** 24-hour wall-clock time in `tz`, "19:00". */
  readonly time: string;
  /** An IANA time zone, "Europe/Berlin". */
  readonly tz: string;
  readonly freq: Freq;
  /** Dates of a rule that won't happen. */
  readonly skips: readonly string[];
  /** Chosen dates, each with its own time. */
  readonly dates?: Readonly<Record<string, string>> | undefined;
}

export interface Session {
  readonly date: string;
  readonly time: string;
  /** The UTC instant. */
  readonly ms: number;
  readonly skipped: boolean;
}

const DAY = 864e5;
/** A rule's dates are looked for this far ahead, at most. */
const MAX_STEPS = 120;

/** Minutes the zone is ahead of UTC at that instant. */
function offsetMinutes(ms: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - ms) / 60000;
}

/** A wall-clock date and time in a time zone, as a UTC instant (DST-safe). */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMinutes(guess, tz) * 60000;
  return guess - offsetMinutes(first, tz) * 60000;
}

const iso = (y: number, m: number, d: number): string =>
  new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return iso(y, m - 1, d + n);
}

/** The same day n months on; the 31st in a shorter month is its last day. */
export function addMonths(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return iso(y, m - 1 + n, Math.min(d, last));
}

function chosen(s: Schedule, now: number, count: number): Session[] {
  return Object.entries(s.dates ?? {})
    .map(([date, time]) => ({
      date,
      time,
      ms: zonedToUtc(date, time, s.tz),
      skipped: false,
    }))
    .filter((x) => x.ms >= now)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, count);
}

/** The rule's k-th date, counted from its start. */
const dateAt = (s: Schedule, k: number): string =>
  s.freq === "m1"
    ? addMonths(s.start, k)
    : addDays(s.start, k * (s.freq === "w2" ? 14 : 7));

/**
 * Steps of the rule already behind `now` (one short, for safety), so a
 * rule started years ago still finds its next dates (review).
 */
function stepsBehind(s: Schedule, now: number): number {
  const today = new Date(now).toISOString().slice(0, 10);
  if (s.freq === "none" || today <= s.start) return 0;
  if (s.freq === "m1") {
    const [y0 = 0, m0 = 1] = s.start.split("-").map(Number);
    const [y1 = 0, m1 = 1] = today.split("-").map(Number);
    return Math.max(0, (y1 - y0) * 12 + (m1 - m0) - 1);
  }
  const days = (Date.parse(today) - Date.parse(s.start)) / DAY;
  return Math.max(0, Math.floor(days / (s.freq === "w2" ? 14 : 7)) - 1);
}

/** The schedule's dates from `now` on, skipped ones marked. */
export function upcoming(s: Schedule, now: number, count = 5): Session[] {
  if (s.freq === "dates") return chosen(s, now, count);
  const skips = new Set(s.skips);
  const out: Session[] = [];
  const first = stepsBehind(s, now);
  for (let k = first; out.length < count && k < first + MAX_STEPS; k++) {
    const date = dateAt(s, k);
    const ms = zonedToUtc(date, s.time, s.tz);
    if (ms >= now)
      out.push({ date, time: s.time, ms, skipped: skips.has(date) });
    if (s.freq === "none") break;
  }
  return out;
}

/** The next date that will happen, or null when there is none. */
export function nextOf(s: Schedule, now: number): Session | null {
  return upcoming(s, now, 12).find((x) => !x.skipped) ?? null;
}

/** Days from today to that instant, in the viewer's own calendar. */
export function daysUntil(ms: number, now: number, tz: string): number {
  const day = (t: number): number =>
    Math.floor((t + offsetMinutes(t, tz) * 60000) / DAY);
  return day(ms) - day(now);
}

/** Today's date in that zone, "2026-11-06" (not the UTC date). */
export const todayIn = (tz: string, now: number): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

/** "Europe/Berlin" reads "Berlin"; "UTC" stays. */
export const cityOf = (tz: string): string =>
  tz === "UTC" ? "UTC" : (tz.split("/").pop() ?? tz).replace(/_/g, " ");

/** Foundry-evening times that fill the quick times you don't use yet. */
export const DEFAULT_TIMES: readonly string[] = [
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];
const QUICK_TIMES = 5;
export const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface QuickTimes {
  /** At most five, sorted, always holding the current time. */
  readonly list: readonly string[];
  /** The ones your schedules use. */
  readonly fromYou: ReadonlySet<string>;
}

/** Times a schedule uses: its rule's time, or each chosen date's own. */
const timesOf = (s: Schedule): readonly string[] =>
  s.freq === "dates" ? Object.values(s.dates ?? {}) : [s.time];

/**
 * Quick times (prototype usedTimes): the times your worlds' schedules use,
 * most used first, then the defaults, with the current time kept.
 */
export function usedTimes(
  schedules: readonly Schedule[],
  current: string,
): QuickTimes {
  const counts = schedules
    .flatMap(timesOf)
    .filter((t) => HH_MM.test(t))
    .reduce<ReadonlyMap<string, number>>(
      (m, t) => new Map([...m, [t, (m.get(t) ?? 0) + 1]]),
      new Map(),
    );
  const mine = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
  const top = [...new Set([...mine, ...DEFAULT_TIMES])].slice(0, QUICK_TIMES);
  const list =
    !current || top.includes(current)
      ? top
      : [...top.slice(0, QUICK_TIMES - 1), current];
  return { list: [...list].sort(), fromYou: new Set(mine) };
}
