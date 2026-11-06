// The Modules tab's tools, in the tab row as the prototype: the filter,
// All / On / Changes, Add, and View options (group by, cards or list).
import type { WorldInfo } from "@module-library/shared/world";
import { useDisclosure } from "../../common/disclosure.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { GROUP_BYS, type GroupBy } from "../../model/library-groups.ts";
import type { WorldModules } from "../../model/world-modules.ts";
import type { WorldView } from "../../store.ts";
import { AddMenu } from "./AddMenu.tsx";

export type Show = "all" | "on" | "changes";
const SHOWS: readonly Show[] = ["all", "on", "changes"];
const LAYOUTS: readonly WorldView["layout"][] = ["cards", "list"];
const LAYOUT_ICON = { cards: "grid-2", list: "list" } as const;

export interface Filters {
  readonly show: Show;
  readonly text: string;
  readonly onShow: (s: Show) => void;
  readonly onText: (s: string) => void;
}

/** Group by and Layout, saved for every world's page. */
function ViewBody(props: { readonly first: { current: HTMLElement | null } }) {
  const { state, store, t } = useUi();
  const view = state.worldView;
  const set = (next: Partial<WorldView>): void => {
    store.set((s) => ({ worldView: { ...s.worldView, ...next } }));
  };
  return (
    <div class="mlc-viewbody">
      <label>
        <span class="ml-label">{t("lib.groupBy")}</span>
        <select
          ref={(el) => {
            props.first.current = el;
          }}
          value={view.by}
          onChange={(e) => set({ by: e.currentTarget.value as GroupBy })}
        >
          {GROUP_BYS.map((b) => (
            <option key={b} value={b}>
              {t(`lib.groupBy.${b}`)}
            </option>
          ))}
        </select>
      </label>
      <span class="ml-label">{t("wp.layout")}</span>
      <span class="ml-seg2" role="group" aria-label={t("wp.layout")}>
        {LAYOUTS.map((l) => (
          <button
            type="button"
            key={l}
            class={view.layout === l ? "on" : ""}
            aria-pressed={view.layout === l}
            onClick={() => set({ layout: l })}
          >
            <Icon name={LAYOUT_ICON[l]} />
            {t(`wp.layout.${l}`)}
          </button>
        ))}
      </span>
    </div>
  );
}

function ViewOptions() {
  const { t } = useUi();
  const d = useDisclosure<HTMLSpanElement>();
  return (
    <span class="mlc-viewwrap" ref={d.wrap}>
      <button
        type="button"
        ref={d.trigger}
        class={`icon${d.open ? " ml-on" : ""}`}
        aria-label={t("wp.view")}
        title={t("wp.view")}
        aria-expanded={d.open}
        onClick={() => d.setOpen(!d.open)}
      >
        <Icon name="sliders" />
      </button>
      {d.open ? (
        <section
          class="ml-pop mlc-viewpop"
          role="region"
          aria-label={t("wp.view")}
        >
          <header>
            <strong>{t("wp.viewTitle")}</strong>
          </header>
          <ViewBody first={d.first} />
        </section>
      ) : null}
    </span>
  );
}

export function ModulesTools(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly filters: Filters;
}) {
  const { t, canChange } = useUi();
  const { filters } = props;
  const count = (s: Show): number =>
    s === "all"
      ? props.model.rows.length
      : s === "on"
        ? props.model.nextCount
        : props.model.changes;
  return (
    <div class="mlc-tools">
      <input
        type="search"
        aria-label={t("wp.filter")}
        placeholder={t("wp.filter")}
        value={filters.text}
        onInput={(e) => filters.onText(e.currentTarget.value)}
      />
      <span class="ml-seg2" role="group" aria-label={t("wp.show")}>
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
      {canChange ? <AddMenu worldId={props.world.id} /> : null}
      <ViewOptions />
    </div>
  );
}
