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
  readonly dates?: Readonly<Record<string, string>>;
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

export function addMonths(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return iso(y, m - 1 + n, d);
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

const step = (s: Schedule, k: number, date: string): string =>
  s.freq === "m1"
    ? addMonths(s.start, k + 1)
    : addDays(date, s.freq === "w2" ? 14 : 7);

/** The schedule's dates from `now` on, skipped ones marked. */
export function upcoming(s: Schedule, now: number, count = 5): Session[] {
  if (s.freq === "dates") return chosen(s, now, count);
  const skips = new Set(s.skips);
  const out: Session[] = [];
  let date = s.start;
  for (let k = 0; out.length < count && k < MAX_STEPS; k++) {
    const ms = zonedToUtc(date, s.time, s.tz);
    if (ms >= now)
      out.push({ date, time: s.time, ms, skipped: skips.has(date) });
    if (s.freq === "none") break;
    date = step(s, k, date);
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

/** "Europe/Berlin" reads "Berlin"; "UTC" stays. */
export const cityOf = (tz: string): string =>
  tz === "UTC" ? "UTC" : (tz.split("/").pop() ?? tz).replace(/_/g, " ");
