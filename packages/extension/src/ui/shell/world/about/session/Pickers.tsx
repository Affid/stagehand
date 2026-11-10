// The session editor's calendar and time zone picker (prototype _sched.js).
import { useState } from "preact/hooks";
import { Icon } from "../../../../common/widgets.tsx";
import { useUi } from "../../../../context.ts";
import { cityOf } from "../../../../model/schedule.ts";
import { BROWSER_TZ, dayName, tzLabel } from "./text.ts";

const pad = (n: number): string => String(n).padStart(2, "0");
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface CalendarProps {
  readonly month: string;
  readonly picked: ReadonlySet<string>;
  readonly marked: ReadonlySet<string>;
  readonly today: string;
  readonly onDay: (date: string) => void;
  readonly onMonth: (month: string) => void;
}

function CalHead(props: {
  readonly month: string;
  readonly onMonth: (m: string) => void;
}) {
  const { t } = useUi();
  const [y = 0, m = 1] = props.month.split("-").map(Number);
  const shift = (n: number): void =>
    props.onMonth(
      new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7),
    );
  return (
    <header>
      <button
        type="button"
        class="icon"
        aria-label={t("sched.prevMonth")}
        onClick={() => shift(-1)}
      >
        <Icon name="chevron-left" />
      </button>
      <strong>
        {new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
      </strong>
      <button
        type="button"
        class="icon"
        aria-label={t("sched.nextMonth")}
        onClick={() => shift(1)}
      >
        <Icon name="chevron-right" />
      </button>
    </header>
  );
}

function Day(
  props: CalendarProps & { readonly date: string; readonly n: number },
) {
  const picked = props.picked.has(props.date);
  const cls = [
    picked ? "sel" : "",
    props.date === props.today ? "today" : "",
    !picked && props.marked.has(props.date) ? "rep" : "",
  ].join(" ");
  return (
    <button
      type="button"
      class={cls}
      disabled={props.date < props.today}
      aria-label={dayName(props.date)}
      aria-pressed={picked}
      onClick={() => props.onDay(props.date)}
    >
      {props.n}
    </button>
  );
}

/** A month of day buttons; past days are off. `marked` days show the rule. */
export function Calendar(props: CalendarProps) {
  const [y = 0, m = 1] = props.month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  return (
    <div class="stw-cal">
      <CalHead month={props.month} onMonth={props.onMonth} />
      <div class="dow">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div class="days">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead${String(i)}`} />
        ))}
        {Array.from({ length: days }, (_, i) => (
          <Day
            key={i}
            {...props}
            date={`${props.month}-${pad(i + 1)}`}
            n={i + 1}
          />
        ))}
      </div>
    </div>
  );
}

const ALL_ZONES: readonly string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [BROWSER_TZ, "UTC"];
const ZONE_LIMIT = 40;

/** Cities whose name, or a word of it, starts with the text; then regions. */
export function findZones(q: string): { hits: string[]; total: number } {
  const text = q.trim().toLowerCase().replace(/_/g, " ");
  if (!text) return { hits: [], total: 0 };
  const scored = ALL_ZONES.map((z) => {
    const city = cityOf(z).toLowerCase();
    const region = (z.split("/")[0] ?? "").toLowerCase();
    const score = city.startsWith(text)
      ? 0
      : city.split(/[ -]/).some((w) => w.startsWith(text))
        ? 1
        : text.length > 1 && region.startsWith(text)
          ? 2
          : -1;
    return { z, score, city };
  })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.city.localeCompare(b.city));
  return {
    hits: scored.slice(0, ZONE_LIMIT).map((x) => x.z),
    total: scored.length,
  };
}

function ZoneList(props: {
  readonly hits: readonly string[];
  readonly total: number;
  readonly q: string;
  readonly active: number;
  readonly onPick: (tz: string) => void;
}) {
  const { t } = useUi();
  const { hits, q } = props;
  return (
    <ul id="st-tzlist" role="listbox" aria-label={t("sched.tz")}>
      {!q.trim() ? <li class="hint">{t("sched.findHint")}</li> : null}
      {q.trim() && !hits.length ? (
        <li class="hint">{t("sched.findNone")}</li>
      ) : null}
      {hits.map((z, i) => (
        <li
          key={z}
          id={`st-tz-${String(i)}`}
          role="option"
          aria-selected={i === props.active}
          class={i === props.active ? "on" : ""}
          onClick={() => props.onPick(z)}
        >
          <span>{cityOf(z)}</span>
          <span class="r">{z.split("/")[0]}</span>
          <span class="o">{tzLabel(z, Date.now())}</span>
        </li>
      ))}
      {props.total > hits.length ? (
        <li class="hint more">
          {t("sched.findMore", { n: String(props.total - hits.length) })}
        </li>
      ) : null}
    </ul>
  );
}

/** Arrows move, Enter picks, Escape goes back (active-descendant pattern). */
function keys(
  e: KeyboardEvent,
  hits: readonly string[],
  active: number,
  go: {
    readonly move: (i: number) => void;
    readonly pick: (z: string) => void;
    readonly back: () => void;
  },
): void {
  const n = hits.length;
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && n) {
    e.preventDefault();
    go.move((active + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const z = hits[active];
    if (z) go.pick(z);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    go.back();
  }
}

function ZoneFinder(props: {
  readonly onPick: (tz: string) => void;
  readonly onBack: () => void;
}) {
  const { t } = useUi();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { hits, total } = findZones(q);
  return (
    <div class="stw-tzfind">
      <div class="in">
        <Icon name="magnifying-glass" />
        <input
          type="search"
          role="combobox"
          list={undefined}
          aria-expanded={hits.length > 0}
          aria-controls="st-tzlist"
          aria-activedescendant={
            hits.length ? `st-tz-${String(active)}` : undefined
          }
          aria-label={t("sched.findLabel")}
          placeholder={t("sched.findLabel")}
          value={q}
          onInput={(e) => {
            setQ(e.currentTarget.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            keys(e, hits, active, {
              move: setActive,
              pick: props.onPick,
              back: props.onBack,
            });
          }}
        />
        <button type="button" onClick={props.onBack}>
          {t("about.cancel")}
        </button>
      </div>
      <ZoneList
        hits={hits}
        total={total}
        q={q}
        active={active}
        onPick={props.onPick}
      />
    </div>
  );
}

/** The schedule's zone, this browser's, and zones the other worlds use. */
export function ZonePick(props: {
  readonly tz: string;
  readonly used: readonly string[];
  readonly onTz: (tz: string) => void;
}) {
  const { t } = useUi();
  const [finding, setFinding] = useState(false);
  if (finding)
    return (
      <ZoneFinder
        onPick={(z) => {
          props.onTz(z);
          setFinding(false);
        }}
        onBack={() => setFinding(false)}
      />
    );
  const top = [...new Set([props.tz, BROWSER_TZ, ...props.used])];
  const note = (z: string): string =>
    z === BROWSER_TZ
      ? ` ${t("sched.thisBrowser")}`
      : props.used.includes(z) && z !== props.tz
        ? ` ${t("sched.usedZone")}`
        : "";
  return (
    <div class="stw-tzrow">
      <select
        aria-label={t("sched.tz")}
        value={props.tz}
        onChange={(e) => props.onTz(e.currentTarget.value)}
      >
        {top.map((z) => (
          <option key={z} value={z}>
            {cityOf(z)}
            {note(z)}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setFinding(true)}>
        <Icon name="magnifying-glass" />
        {t("sched.findZone")}
      </button>
    </div>
  );
}
