// The Library's tabs, as the prototype: Modules, Systems, By world and
// Updates (updates plan), each with its icon and count; Updates shows a
// spinner while our check runs.
import { TabList } from "@stagehand/ui/common/tabs.tsx";
import { Icon } from "@stagehand/ui/common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { updatesCount } from "../../../model/package-updates.ts";
import { type Layout, useLayout } from "../../phone/layout.ts";

export type LibTab = "modules" | "systems" | "grid" | "updates";
/** By world stays off the phone (the owner, 2026-11-08); a tablet keeps it. */
const tabsFor = (layout: Layout, updates: boolean): LibTab[] => [
  "modules",
  "systems",
  ...(layout === "phone" ? [] : (["grid"] as const)),
  ...(updates ? (["updates"] as const) : []),
];

/** The tab shown: a library left on By world opens on the cards on a phone. */
export const shownTab = (tab: LibTab, layout: Layout): LibTab =>
  layout === "phone" && tab === "grid" ? "modules" : tab;
/** The tabs' and panel's ids (LibraryPage draws the panel). */
export const LIBRARY_TABS = "st-lt";
const ICONS: Record<LibTab, string> = {
  modules: "plug",
  systems: "dice",
  grid: "table-cells",
  updates: "cloud-arrow-down",
};

/** Our own check needs Foundry's checkPackage (an adapter flag per version). */
export const hasUpdatesTab = (
  state: ReturnType<typeof useUi>["state"],
): boolean =>
  state.adapter.status !== "safe-mode" &&
  state.adapter.adapter.flags.packageCheck === true;

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
    updates: updatesCount(state),
  };
  const count = (k: LibTab) =>
    k === "updates" && state.check.running ? (
      <i class="fa-solid fa-spinner fa-spin" aria-hidden="true" />
    ) : k === "updates" && counts[k] ? (
      <b class="w">{counts[k]}</b>
    ) : (
      counts[k]
    );
  return (
    <nav class="sts-subtabs">
      <TabList
        id={LIBRARY_TABS}
        label={t("lib.tab.label")}
        tabs={tabsFor(layout, hasUpdatesTab(state))}
        current={shownTab(props.tab, layout)}
        onTab={props.onTab}
        render={(k) => (
          <>
            <Icon name={ICONS[k]} />
            {t(`lib.tab.${k}`)} <span class="c">{count(k)}</span>
          </>
        )}
      />
    </nav>
  );
}
