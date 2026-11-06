// The Library's tabs, as the prototype: Modules, Systems and By world, each
// with its icon and count.
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";

export type LibTab = "modules" | "systems" | "grid";
const TABS: readonly LibTab[] = ["modules", "systems", "grid"];
const ICONS: Record<LibTab, string> = {
  modules: "plug",
  systems: "dice",
  grid: "table-cells",
};

export function LibraryTabs(props: {
  readonly tab: LibTab;
  readonly onTab: (tab: LibTab) => void;
}) {
  const { state, t } = useUi();
  const setup = state.data.setup;
  const counts: Record<LibTab, number> = {
    modules: setup?.modules.length ?? 0,
    systems: setup?.systems.length ?? 0,
    grid: setup?.worlds.length ?? 0,
  };
  return (
    <nav class="mls-subtabs">
      <span class="mls-tablist" role="tablist">
        {TABS.map((k) => (
          <button
            type="button"
            key={k}
            role="tab"
            class={props.tab === k ? "active" : ""}
            aria-selected={props.tab === k}
            onClick={() => props.onTab(k)}
          >
            <Icon name={ICONS[k]} />
            {t(`lib.tab.${k}`)} <span class="c">{counts[k]}</span>
          </button>
        ))}
      </span>
    </nav>
  );
}
