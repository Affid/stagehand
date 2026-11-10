// The next session as the prototype shows it: the date in the schedule's
// own time zone (and the viewer's, when it differs), the rule, and the next
// dates with Skip / Restore, or Remove for chosen dates.
import type { WorldInfo } from "@stagehand/shared/world";
import { Icon } from "../../../../common/widgets.tsx";
import { useUi } from "../../../../context.ts";
import {
  nextOf,
  type Schedule,
  type Session,
  upcoming,
} from "../../../../model/schedule.ts";
import { useSave } from "../../AboutEdit.tsx";
import { BROWSER_TZ, relDays, ruleText, tzLabel, whenIn } from "./text.ts";

/** Foundry's nextSession for a schedule: its next date, or none. */
export const nextIso = (s: Schedule, now: number): string | null => {
  const n = nextOf(s, now);
  return n ? new Date(n.ms).toISOString() : null;
};

/** Saves a changed schedule together with the next session it gives. */
export function useSaveSchedule(worldId: string) {
  const save = useSave(worldId);
  return (s: Schedule | null): Promise<boolean> =>
    save({ schedule: s, nextSession: s ? nextIso(s, Date.now()) : null });
}

/** Skip or restore a rule's date; remove a chosen date. */
function useToggle(world: WorldInfo, s: Schedule) {
  const saveSchedule = useSaveSchedule(world.id);
  return (x: Session): void => {
    if (s.freq === "dates") {
      const dates = Object.fromEntries(
        Object.entries(s.dates ?? {}).filter(([d]) => d !== x.date),
      );
      void saveSchedule(Object.keys(dates).length ? { ...s, dates } : null);
      return;
    }
    const skips = x.skipped
      ? s.skips.filter((d) => d !== x.date)
      : [...s.skips, x.date];
    void saveSchedule({ ...s, skips });
  };
}

function UpcomingRow(props: {
  readonly x: Session;
  readonly s: Schedule;
  readonly isNext: boolean;
  readonly canEdit: boolean;
  readonly onToggle: (x: Session) => void;
}) {
  const { t } = useUi();
  const { x, s } = props;
  const verb = s.freq === "dates" ? "remove" : x.skipped ? "restore" : "skip";
  return (
    <li class={`${x.skipped ? "skipped" : ""}${props.isNext ? " next" : ""}`}>
      <span class="d">{whenIn(x.ms, s.tz)}</span>
      {props.isNext ? (
        <span class="stw-pill ok">{t("sched.next")}</span>
      ) : x.skipped ? (
        <span class="stw-pill">{t("sched.skipped")}</span>
      ) : (
        <span />
      )}
      {props.canEdit ? (
        <button
          type="button"
          class="st-link"
          aria-label={t(`sched.${verb}Date`, { date: whenIn(x.ms, s.tz) })}
          onClick={() => props.onToggle(x)}
        >
          {t(`sched.${verb}`)}
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

function Upcoming(props: {
  readonly world: WorldInfo;
  readonly s: Schedule;
  readonly canEdit: boolean;
}) {
  const { t } = useUi();
  const { s } = props;
  const toggle = useToggle(props.world, s);
  const now = Date.now();
  const custom = s.freq === "dates";
  const all = upcoming(s, now, custom ? 999 : 3);
  const shown = all.slice(0, custom ? 4 : 3);
  const next = nextOf(s, now);
  const more = all.length - shown.length;
  return (
    <ol class="stw-upcoming">
      {shown.map((x) => (
        <UpcomingRow
          key={x.date}
          x={x}
          s={s}
          isNext={next?.ms === x.ms}
          canEdit={props.canEdit}
          onToggle={toggle}
        />
      ))}
      {custom && more > 0 ? (
        <li class="more">
          <span>
            {t(more === 1 ? "sched.more.one" : "sched.more.other", {
              n: String(more),
            })}
          </span>
        </li>
      ) : null}
    </ol>
  );
}

function When(props: { readonly ms: number; readonly tz: string }) {
  const { t } = useUi();
  const mine = whenIn(props.ms, BROWSER_TZ);
  return (
    <div class="stw-next">
      <Icon name="calendar-day" />
      <div>
        <strong>{whenIn(props.ms, props.tz)}</strong>
        <span>
          {relDays(t, props.ms, Date.now())} · {tzLabel(props.tz, props.ms)}
          {mine !== whenIn(props.ms, props.tz) ? (
            <>
              {" · "}
              <b>{t("sched.yourTime", { when: mine })}</b>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function SessionView(props: {
  readonly world: WorldInfo;
  readonly canEdit: boolean;
}) {
  const { t } = useUi();
  const { world } = props;
  const s = world.schedule;
  const next = s ? nextOf(s, Date.now()) : null;
  const foundryOnly =
    !s && world.nextSession ? Date.parse(world.nextSession) : NaN;
  if (s && next)
    return (
      <>
        <When ms={next.ms} tz={s.tz} />
        {s.freq === "none" ? null : (
          <div class="stw-rule" title={t("sched.how")}>
            <Icon name={s.freq === "dates" ? "calendar-days" : "repeat"} />
            <span>{ruleText(t, s, Date.now())}</span>
          </div>
        )}
        {s.freq === "none" ? null : (
          <Upcoming world={world} s={s} canEdit={props.canEdit} />
        )}
      </>
    );
  if (Number.isFinite(foundryOnly))
    return <When ms={foundryOnly} tz={BROWSER_TZ} />;
  return (
    <div class="stw-next none">
      <Icon name="calendar-plus" />
      <span>{t("sched.none")}</span>
    </div>
  );
}
