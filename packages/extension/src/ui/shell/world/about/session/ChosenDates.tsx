// Chosen dates under the calendar (prototype _sched.js, .stw-chosen): each
// date with its own time, which can be changed, and Remove.
import { Icon } from "../../../../common/widgets.tsx";
import { useUi } from "../../../../context.ts";
import { HH_MM, todayIn, zonedToUtc } from "../../../../model/schedule.ts";
import { BROWSER_TZ, dateLabel } from "./text.ts";

interface ChosenProps {
  readonly dates: Readonly<Record<string, string>>;
  readonly tz: string;
  readonly onTime: (date: string, time: string) => void;
  readonly onRemove: (date: string) => void;
}

function ChosenRow(
  props: ChosenProps & {
    readonly date: string;
    readonly time: string;
    readonly label: string;
    readonly past: boolean;
  },
) {
  const { t } = useUi();
  const { date, time, label } = props;
  /** A valid HH:MM becomes the date's time; anything else shows it again. */
  const commit = (input: HTMLInputElement): void => {
    const v = input.value.trim();
    const ok = HH_MM.test(v);
    input.value = ok ? v : time;
    if (ok && v !== time) props.onTime(date, v);
  };
  return (
    <li class={props.past ? "past" : ""}>
      <span class="d">{label}</span>
      <input
        type="text"
        class="tt"
        value={time}
        maxLength={5}
        pattern="[0-2][0-9]:[0-5][0-9]"
        aria-label={t("sched.timeOn", { date: label })}
        onBlur={(e) => commit(e.currentTarget)}
      />
      <button
        type="button"
        class="icon"
        aria-label={t("sched.removeDate", { date: label })}
        onClick={() => props.onRemove(date)}
      >
        <Icon name="xmark" />
      </button>
    </li>
  );
}

export function ChosenDates(props: ChosenProps) {
  const { t } = useUi();
  const now = Date.now();
  const year = Number(todayIn(BROWSER_TZ, now).slice(0, 4));
  const rows = Object.entries(props.dates).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return (
    <ol class="stw-chosen">
      {rows.length ? (
        rows.map(([date, time]) => (
          <ChosenRow
            key={date}
            {...props}
            date={date}
            time={time}
            label={dateLabel(date, year)}
            past={zonedToUtc(date, time, props.tz) < now}
          />
        ))
      ) : (
        <li class="none">{t("sched.noDates")}</li>
      )}
    </ol>
  );
}
