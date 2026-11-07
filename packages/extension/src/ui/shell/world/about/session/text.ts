// How the schedule reads (prototype _sched.js): dates in the schedule's own
// time zone, the zone named with its offset, and the rule in words.
import type { Translate } from "../../../../i18n.ts";
import {
  cityOf,
  daysUntil,
  type Schedule,
  upcoming,
} from "../../../../model/schedule.ts";

export const BROWSER_TZ =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const fmt = (ms: number, tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(ms);

/** "Tue 10 Nov, 19:00" in that zone, 24-hour. */
export const whenIn = (ms: number, tz: string): string =>
  `${fmt(ms, tz, { weekday: "short", day: "numeric", month: "short" })}, ${fmt(ms, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;

/**
 * A calendar day's name for screen readers, "Sunday, 1 November 2026": it
 * holds the day number the button shows (label in content, WCAG 2.5.3).
 */
export function dayName(date: string): string {
  const ms = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(ms)) return date;
  return fmt(ms, "UTC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "Central European Standard Time (UTC+1)". */
export function tzLabel(tz: string, ms: number): string {
  const part = (style: "shortOffset" | "long"): string =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: style })
      .formatToParts(ms)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  const off = part("shortOffset").replace("GMT", "UTC");
  const long = part("long");
  const name =
    !long || /^GMT|^UTC|^Coordinated/.test(long)
      ? tz === "UTC"
        ? "UTC"
        : `${cityOf(tz)} time`
      : long;
  return `${name} (${off === "UTC" ? "UTC+0" : off})`;
}

/** "today", "tomorrow", "in 4 days", "2 days ago", in the viewer's calendar. */
export function relDays(t: Translate, ms: number, now: number): string {
  const n = daysUntil(ms, now, BROWSER_TZ);
  if (n === 0) return t("sched.today");
  if (n === 1) return t("sched.tomorrow");
  return n > 1
    ? t("sched.inDays", { n: String(n) })
    : t("sched.daysAgo", { n: String(-n) });
}

const ordinal = (d: number): string => {
  const teen = [11, 12, 13].includes(d % 100);
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][d % 10] ?? "th");
  return `${String(d)}${suffix}`;
};

/** "Every Tuesday at 19:00", "Every month on the 10th at 19:00", … */
export function ruleText(t: Translate, s: Schedule, now: number): string {
  if (s.freq === "none") return "";
  if (s.freq === "dates") {
    const n = upcoming(s, now, 999).length;
    return t(n === 1 ? "sched.datesLeft.one" : "sched.datesLeft.other", {
      n: String(n),
    });
  }
  const [y = 0, m = 1, d = 1] = s.start.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
  if (s.freq === "m1")
    return t("sched.monthly", { day: ordinal(d), time: s.time });
  return t(s.freq === "w2" ? "sched.fortnightly" : "sched.weekly", {
    weekday,
    time: s.time,
  });
}
