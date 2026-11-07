// The editor's summary (prototype _sched.js): the first date in the
// schedule's own zone, and what players elsewhere see.
import { Icon } from "../../../../common/widgets.tsx";
import { useUi } from "../../../../context.ts";
import { plural } from "../../../../i18n.ts";
import { cityOf } from "../../../../model/schedule.ts";
import { otherZones, whenIn } from "./text.ts";

/** Splits a string around the examples, so a translation can place them. */
const MARK = "\u0000";

function Others(props: { readonly ms: number; readonly tz: string }) {
  const { t } = useUi();
  const [before = "", after = ""] = t("sched.others", { list: MARK }).split(
    MARK,
  );
  return (
    <>
      {before}
      {otherZones(props.ms, props.tz).map((x) => (
        <span key={x.city}>
          <b>{x.time}</b> {x.city}
          {x.weekday ? ` (${x.weekday})` : ""}
        </span>
      ))}
      {after}
    </>
  );
}

export function Summary(props: {
  readonly ms: number;
  readonly tz: string;
  /** Chosen dates: how many there are; undefined for a rule. */
  readonly chosen?: number | undefined;
}) {
  const { t } = useUi();
  const { chosen, ms, tz } = props;
  const when = whenIn(ms, tz);
  const none = chosen === 0;
  const head =
    chosen === undefined
      ? when
      : none
        ? t("sched.noneChosen")
        : plural(t, "sched.datesNext", chosen, { when });
  return (
    <div class="sum">
      <Icon name="calendar-check" />
      <div>
        <strong>
          {head} <span>{t("sched.cityTime", { city: cityOf(tz) })}</span>
        </strong>
        <span class="others">
          {none ? t("sched.clickToAdd") : <Others ms={ms} tz={tz} />}
        </span>
      </div>
    </div>
  );
}
