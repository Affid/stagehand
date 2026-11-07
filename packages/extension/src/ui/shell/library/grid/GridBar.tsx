// The grid's bar, as the prototype: Group by, which worlds to Show (and how
// many, with hidden worlds that have changes), the module filter, and a hint.
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { GROUP_BYS, type GroupBy } from "../../../model/library-groups.ts";
import {
  GRID_SHOWS,
  type GridShow,
  type GridWorlds,
} from "../../../model/world-grid.ts";

interface BarProps {
  readonly by: GroupBy;
  readonly onBy: (by: GroupBy) => void;
  readonly show: GridShow;
  readonly onShow: (s: GridShow) => void;
  readonly result: GridWorlds;
}

function Showing(props: BarProps) {
  const { t } = useUi();
  const { shown, total, hiddenQueued } = props.result;
  return (
    <span class="mll-showing">
      {shown.length === total
        ? plural(t, "grid.showing", total)
        : t("grid.showingSome", { n: shown.length, total })}
      {hiddenQueued.length ? (
        <>
          {" · "}
          <button
            type="button"
            class="ml-link"
            title={hiddenQueued.map((w) => w.title).join(", ")}
            onClick={() => props.onShow("all")}
          >
            {plural(t, "grid.hidden", hiddenQueued.length)}
          </button>
        </>
      ) : null}
    </span>
  );
}

function Selects(props: BarProps) {
  const { t } = useUi();
  return (
    <>
      <span class="ml-label">{t("lib.groupBy")}</span>
      <select
        aria-label={t("lib.groupBy")}
        value={props.by}
        onChange={(e) => props.onBy(e.currentTarget.value as GroupBy)}
      >
        {GROUP_BYS.map((b) => (
          <option key={b} value={b}>
            {t(`lib.groupBy.${b}`)}
          </option>
        ))}
      </select>
      <span class="ml-label">{t("grid.show")}</span>
      <select
        aria-label={t("grid.show")}
        value={props.show}
        onChange={(e) => props.onShow(e.currentTarget.value as GridShow)}
      >
        {GRID_SHOWS.map((s) => (
          <option key={s} value={s}>
            {t(`grid.show.${s}`)}
          </option>
        ))}
      </select>
    </>
  );
}

export function GridBar(props: BarProps) {
  const { state, store, t } = useUi();
  return (
    <div class="ml-row mll-gridbar">
      <Selects {...props} />
      <Showing {...props} />
      <input
        type="search"
        aria-label={t("grid.filter")}
        placeholder={t("grid.filter")}
        value={state.filter.text}
        onInput={(e) => {
          const text = e.currentTarget.value;
          store.set((s) => ({ filter: { ...s.filter, text }, selection: [] }));
        }}
      />
      <span class="ml-spacer" />
      <span
        class="ml-muted mll-gridhelp"
        role="img"
        title={t("grid.help")}
        aria-label={t("grid.help")}
      >
        <i class="fa-regular fa-circle-question" aria-hidden="true" />
      </span>
    </div>
  );
}

/** What the colours mean, and which worlds change at their next launch. */
export function GridLegend() {
  const { state, store, t } = useUi();
  const queued = (state.data.setup?.worlds ?? []).filter((w) =>
    state.data.commands.some(
      (c) => c.worldId === w.id && c.status === "pending",
    ),
  );
  return (
    <div class="mls-gridlegend">
      <span>
        <i class="sw plus" />
        {t("grid.legend.on")}
      </span>
      <span>
        <i class="sw minus" />
        {t("grid.legend.off")}
      </span>
      <span>
        <i class="sw prob" />
        {t("grid.legend.prob")}
      </span>
      <span class="ml-spacer" />
      <span>
        {queued.length ? (
          <>
            {plural(t, "grid.legend.queued", queued.length)}{" "}
            {queued.flatMap((w, i) => [
              i ? ", " : "",
              <button
                key={w.id}
                type="button"
                class="ml-link"
                onClick={() =>
                  store.set({ route: { kind: "world", worldId: w.id } })
                }
              >
                {w.title}
              </button>,
            ])}
          </>
        ) : (
          t("grid.legend.none")
        )}
      </span>
    </div>
  );
}
