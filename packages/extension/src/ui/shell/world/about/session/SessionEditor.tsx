// Setting the next session, as the prototype: a calendar, Repeats (none,
// weekly, every 2 weeks, monthly, chosen dates), a 24-hour time with quick
// times, and the time zone named. Saved as our schedule in the world's flags.
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { useUi } from "../../../../context.ts";
import {
  addDays,
  type Freq,
  type QuickTimes,
  type Schedule,
  todayIn,
  upcoming,
  usedTimes,
  zonedToUtc,
} from "../../../../model/schedule.ts";
import { ChosenDates } from "./ChosenDates.tsx";
import { Calendar, ZonePick } from "./Pickers.tsx";
import { BROWSER_TZ, tzLabel } from "./text.ts";
import { nextIso, useSaveSchedule } from "./SessionView.tsx";
import { Summary } from "./Summary.tsx";

const FREQS: readonly Freq[] = ["none", "w1", "w2", "m1", "dates"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

interface Draft extends Schedule {
  readonly month: string;
}

/** Today in the viewer's own calendar, not the UTC date (review). */
const today = (): string => todayIn(BROWSER_TZ, Date.now());

function startDraft(s: Schedule | undefined): Draft {
  const start = s?.start ?? addDays(today(), 4);
  return {
    start,
    time: s?.time ?? "19:00",
    tz: s?.tz ?? BROWSER_TZ,
    freq: s?.freq ?? "none",
    skips: s?.skips ?? [],
    dates: s?.dates ?? {},
    month: start.slice(0, 7),
  };
}

/** The draft as a schedule: chosen dates start at their first. */
function toSchedule(d: Draft, prev: Schedule | undefined): Schedule {
  const chosen = Object.keys(d.dates ?? {}).sort();
  return {
    start: d.freq === "dates" ? (chosen[0] ?? d.start) : d.start,
    time: d.time,
    tz: d.tz,
    freq: d.freq,
    // Skips belong to the rule as it was: a new start, time or zone resets them.
    skips:
      prev?.freq === d.freq &&
      prev.start === d.start &&
      prev.time === d.time &&
      prev.tz === d.tz
        ? prev.skips
        : [],
    ...(d.freq === "dates" ? { dates: d.dates ?? {} } : {}),
  };
}

function TimeRow(props: {
  readonly time: string;
  readonly quick: QuickTimes;
  /** Under the quick times: chosen dates say new dates get this time. */
  readonly hint?: string | undefined;
  readonly onTime: (t: string) => void;
}) {
  const { t } = useUi();
  const [hh = "19", mm = "00"] = props.time.split(":");
  const mins = [...new Set(["00", "15", "30", "45", mm])].sort();
  return (
    <div class="t">
      <div class="hm">
        <select
          aria-label={t("sched.hour")}
          value={hh}
          onChange={(e) => props.onTime(`${e.currentTarget.value}:${mm}`)}
        >
          {HOURS.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
        <span>:</span>
        <select
          aria-label={t("sched.minutes")}
          value={mm}
          onChange={(e) => props.onTime(`${hh}:${e.currentTarget.value}`)}
        >
          {mins.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <span class="h24">{t("sched.h24")}</span>
      </div>
      <div class="chips">
        {props.quick.list.map((x) => (
          <button
            type="button"
            key={x}
            class={x === props.time ? "on" : ""}
            title={props.quick.fromYou.has(x) ? t("sched.usedTime") : undefined}
            onClick={() => props.onTime(x)}
          >
            {x}
          </button>
        ))}
      </div>
      {props.hint ? <span class="tzl">{props.hint}</span> : null}
    </div>
  );
}

function Bar(props: {
  readonly draft: Draft;
  readonly world: WorldInfo;
  readonly onDone: () => void;
}) {
  const { t } = useUi();
  const saveSchedule = useSaveSchedule(props.world.id);
  const s = toSchedule(props.draft, props.world.schedule);
  const empty = s.freq === "dates" && Object.keys(s.dates ?? {}).length === 0;
  const run = (v: Schedule | null): void => {
    void saveSchedule(v).then((ok) => {
      if (ok) props.onDone();
    });
  };
  return (
    <div class="bar">
      <button
        type="button"
        class="bright"
        disabled={empty}
        onClick={() => run(s)}
      >
        {t("about.save")}
      </button>
      <button type="button" onClick={props.onDone}>
        {t("about.cancel")}
      </button>
      {props.world.schedule || props.world.nextSession ? (
        <>
          <span class="ml-spacer" />
          <button type="button" onClick={() => run(null)}>
            {t("sched.clear")}
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Repeats, time and time zone beside the calendar. */
function Side(props: {
  readonly d: Draft;
  readonly set: (next: Partial<Draft>) => void;
  readonly first: string | null;
}) {
  const { state, t } = useUi();
  const { d, set } = props;
  const custom = d.freq === "dates";
  const schedules = (state.data.setup?.worlds ?? []).flatMap((w) =>
    w.schedule ? [w.schedule] : [],
  );
  const used = [...new Set(schedules.map((s) => s.tz))];
  return (
    <div class="side">
      <label>{t("sched.repeats")}</label>
      <select
        aria-label={t("sched.repeats")}
        value={d.freq}
        onChange={(e) => set({ freq: e.currentTarget.value as Freq })}
      >
        {FREQS.map((f) => (
          <option key={f} value={f}>
            {t(`sched.freq.${f}`)}
          </option>
        ))}
      </select>
      <label>{custom ? t("sched.usualTime") : t("sched.time")}</label>
      <TimeRow
        time={d.time}
        quick={usedTimes(schedules, d.time)}
        hint={custom ? t("sched.newDates") : undefined}
        onTime={(time) => set({ time })}
      />
      <label>{t("sched.tz")}</label>
      <div>
        <ZonePick tz={d.tz} used={used} onTz={(tz) => set({ tz })} />
        <span class="tzl">
          {tzLabel(d.tz, props.first ? Date.parse(props.first) : Date.now())}
        </span>
      </div>
    </div>
  );
}

const dropDate = (d: Draft, date: string): Partial<Draft> => ({
  dates: Object.fromEntries(
    Object.entries(d.dates ?? {}).filter(([k]) => k !== date),
  ),
});

/** A day on the calendar: the start of a rule, or a chosen date in or out. */
function pickDay(d: Draft, date: string): Partial<Draft> {
  if (d.freq !== "dates") return { start: date };
  const dates = d.dates ?? {};
  return date in dates
    ? dropDate(d, date)
    : { dates: { ...dates, [date]: d.time } };
}

/** Days the calendar marks: the chosen dates, or the rule's next ones. */
const markedDays = (d: Draft): ReadonlySet<string> =>
  new Set(
    d.freq === "dates"
      ? Object.keys(d.dates ?? {})
      : upcoming({ ...d, skips: [] }, Date.now(), 40).map((x) => x.date),
  );

export function SessionEditor(props: {
  readonly world: WorldInfo;
  readonly onDone: () => void;
}) {
  const [d, setD] = useState<Draft>(() => startDraft(props.world.schedule));
  /** A change, or one worked out from the latest draft (blur, then click). */
  const set = (next: Partial<Draft> | ((x: Draft) => Partial<Draft>)): void => {
    setD((x) => ({ ...x, ...(typeof next === "function" ? next(x) : next) }));
  };
  const custom = d.freq === "dates";
  const marked = markedDays(d);
  const first = nextIso(toSchedule(d, undefined), Date.now());
  // As the prototype: with no date still to come, the draft's own date.
  const firstMs = first ? Date.parse(first) : zonedToUtc(d.start, d.time, d.tz);
  return (
    <div class={`mlw-sched${custom ? " custom" : ""}`}>
      <Calendar
        month={d.month}
        picked={custom ? marked : new Set([d.start])}
        marked={marked}
        today={today()}
        onDay={(date) => {
          set((x) => pickDay(x, date));
        }}
        onMonth={(month) => {
          set({ month });
        }}
      />
      <Side d={d} set={set} first={first} />
      {custom ? (
        <ChosenDates
          dates={d.dates ?? {}}
          tz={d.tz}
          onTime={(date, time) => {
            set((x) => ({ dates: { ...x.dates, [date]: time } }));
          }}
          onRemove={(date) => {
            set((x) => dropDate(x, date));
          }}
        />
      ) : null}
      <Summary
        ms={firstMs}
        tz={d.tz}
        chosen={custom ? Object.keys(d.dates ?? {}).length : undefined}
      />
      <Bar draft={d} world={props.world} onDone={props.onDone} />
    </div>
  );
}
