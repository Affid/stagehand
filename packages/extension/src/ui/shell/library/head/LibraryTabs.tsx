// The Library's tabs, as the prototype: Modules, Systems and By world, each
// with its icon and count.
import { TabList } from "../../../common/tabs.tsx";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";

export type LibTab = "modules" | "systems" | "grid";
const TABS: readonly LibTab[] = ["modules", "systems", "grid"];
/** The tabs' and panel's ids (LibraryPage draws the panel). */
export const LIBRARY_TABS = "ml-lt";
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
      <TabList
        id={LIBRARY_TABS}
        label={t("lib.tab.label")}
        tabs={TABS}
        current={props.tab}
        onTab={props.onTab}
        render={(k) => (
          <>
            <Icon name={ICONS[k]} />
            {t(`lib.tab.${k}`)} <span class="c">{counts[k]}</span>
          </>
        )}
      />
    </nav>
  );
}
