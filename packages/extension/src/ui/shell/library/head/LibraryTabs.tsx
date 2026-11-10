// The Library's tabs, as the prototype: Modules, Systems and By world, each
// with its icon and count.
import { TabList } from "../../../common/tabs.tsx";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { type Layout, useLayout } from "../../phone/layout.ts";

export type LibTab = "modules" | "systems" | "grid";
const TABS: readonly LibTab[] = ["modules", "systems", "grid"];
/** By world stays off the phone (the owner, 2026-11-08); a tablet keeps it. */
const PHONE_TABS: readonly LibTab[] = ["modules", "systems"];

/** The tab shown: a library left on By world opens on the cards on a phone. */
export const shownTab = (tab: LibTab, layout: Layout): LibTab =>
  layout === "phone" && tab === "grid" ? "modules" : tab;
/** The tabs' and panel's ids (LibraryPage draws the panel). */
export const LIBRARY_TABS = "st-lt";
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
  const layout = useLayout();
  const setup = state.data.setup;
  const counts: Record<LibTab, number> = {
    modules: setup?.modules.length ?? 0,
    systems: setup?.systems.length ?? 0,
    grid: setup?.worlds.length ?? 0,
  };
  return (
    <nav class="sts-subtabs">
      <TabList
        id={LIBRARY_TABS}
        label={t("lib.tab.label")}
        tabs={layout === "phone" ? PHONE_TABS : TABS}
        current={shownTab(props.tab, layout)}
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
