// The view's tools row, as the mockup: the filter, All / On / Changes,
// Apply preset... (full Gamemasters), and Group by inline.
import { Icon } from "@stagehand/ui/common/widgets.tsx";
import { useModules } from "@stagehand/ui/context.ts";
import { GROUP_BYS, type GroupBy } from "@stagehand/ui/model/library-groups.ts";
import type { WorldModules } from "@stagehand/ui/model/world-modules.ts";
import type { Filters, Show } from "@stagehand/ui/world/ModulesTab.tsx";

const SHOWS: readonly Show[] = ["all", "on", "changes"];

function ShowButtons(props: {
  readonly model: WorldModules;
  readonly filters: Filters;
}) {
  const { t } = useModules();
  const { model, filters } = props;
  const count = (s: Show): number =>
    s === "all"
      ? model.rows.length
      : s === "on"
        ? model.nextCount
        : model.changes;
  return (
    <span class="st-seg2" role="group" aria-label={t("wp.show")}>
      {SHOWS.map((s) => (
        <button
          type="button"
          key={s}
          class={filters.show === s ? "on" : ""}
          aria-pressed={filters.show === s}
          onClick={() => filters.onShow(s)}
        >
          {t(`wp.show.${s}`)} <span class="c">{count(s)}</span>
        </button>
      ))}
    </span>
  );
}

export function Tools(props: {
  readonly model: WorldModules;
  readonly filters: Filters;
  readonly by: GroupBy;
  readonly onBy: (by: GroupBy) => void;
  /** Absent: no Apply preset here. */
  readonly onApplyPreset?: (() => void) | undefined;
}) {
  const { t } = useModules();
  const { filters } = props;
  return (
    <div class="stc-tools">
      <input
        type="search"
        aria-label={t("wp.filter")}
        placeholder={t("wp.filter")}
        value={filters.text}
        onInput={(e) => filters.onText(e.currentTarget.value)}
        // Enter would submit Foundry's form, the window's only text field.
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      <ShowButtons model={props.model} filters={filters} />
      {props.onApplyPreset ? (
        <button
          type="button"
          class="stagehand-preset-btn"
          onClick={props.onApplyPreset}
        >
          <Icon name="layer-group" />
          {t("mm.applyPreset")}
        </button>
      ) : null}
      <label class="stc-group">
        <span>{t("lib.groupBy")}</span>
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
      </label>
    </div>
  );
}
