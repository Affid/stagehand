// A world page's body: the tab row (Modules, About, Backups with icons and
// counts, and the Modules tools), the open tab, then recent changes.
import type { WorldInfo } from "@module-library/shared/world";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { TabList, TabPanel } from "../../common/tabs.tsx";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import type { WorldModules } from "../../model/world-modules.ts";
import { worldRow } from "../../model/worlds.ts";
import { HistoryList } from "../../worlds/commands.tsx";
import { AboutTab } from "./AboutTab.tsx";
import { BackupsTab } from "./backups/BackupsTab.tsx";
import { ModulesTab, useFilters } from "./ModulesTab.tsx";
import { ModulesTools } from "./ModulesTools.tsx";
import { NotSetUp } from "./NotSetUp.tsx";
import type { WorldBackups } from "./useBackups.ts";
import { isCompact, useLayout } from "../phone/layout.ts";

export type WorldTab = "modules" | "about" | "backups";
type Tab = WorldTab;
const TABS: readonly Tab[] = ["modules", "about", "backups"];
const WORLD_TABS = "ml-wt";
const ICONS: Record<Tab, string> = {
  modules: "plug",
  about: "scroll",
  backups: "floppy-disks",
};

/**
 * "12 on", or "14 after launch" while changes wait ("11 → 14" in a phone's
 * short tab row); Foundry's backups.
 */
function useCounts(model: WorldModules, backups: WorldBackups) {
  const { t } = useUi();
  const compact = isCompact(useLayout());
  const list = backups.view.list;
  const after = compact
    ? t("mlp.countArrow", { from: model.nowCount, to: model.nextCount })
    : t("wt.afterLaunch", { n: model.nextCount });
  // The arrow, said in words (screen readers read "→" unevenly).
  const spoken =
    compact && model.tracked && model.changes
      ? t("mlp.countSr", { from: model.nowCount, to: model.nextCount })
      : undefined;
  return {
    modules: model.tracked
      ? model.changes
        ? after
        : t("wt.on", { n: model.nextCount })
      : "",
    about: "",
    backups: list ? String(list.length) : "",
    spoken,
  } satisfies Record<Tab, string> & { readonly spoken?: string | undefined };
}

function TabRow(props: {
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
  readonly counts: Record<Tab, string> & {
    readonly spoken?: string | undefined;
  };
  readonly children?: ComponentChildren;
}) {
  const { t } = useUi();
  const spoken = props.counts.spoken;
  return (
    <nav class="mls-subtabs">
      <TabList
        id={WORLD_TABS}
        label={t("wt.label")}
        tabs={TABS}
        current={props.tab}
        onTab={props.onTab}
        render={(k) => (
          <>
            <Icon name={ICONS[k]} />
            {t(`wt.${k}`)}
            {props.counts[k] ? (
              <>
                {" "}
                <span
                  class="c"
                  aria-hidden={k === "modules" && spoken ? true : undefined}
                >
                  {props.counts[k]}
                </span>
                {k === "modules" && spoken ? (
                  <span class="ml-sr-only">{spoken}</span>
                ) : null}
              </>
            ) : null}
          </>
        )}
      />
      {props.children}
    </nav>
  );
}

/** The Backups tab stays mounted once opened. */
function useOpened(tab: Tab): boolean {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (tab === "backups") setOpened(true);
  }, [tab]);
  return opened;
}

/** The world's recent changes, under its modules. */
function Recent(props: { readonly world: WorldInfo }) {
  const { state, t } = useUi();
  const recent = worldRow(state.data, props.world).recent;
  if (!recent.length) return null;
  return (
    <details class="mlw-history">
      <summary>{t("wp.history")}</summary>
      <HistoryList commands={recent} />
    </details>
  );
}

export function WorldBody(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly backups: WorldBackups;
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
}) {
  const { world, model, tab, onTab } = props;
  const filters = useFilters();
  const counts = useCounts(model, props.backups);
  const opened = useOpened(tab);
  const tools =
    tab === "modules" && model.tracked ? (
      <ModulesTools world={world} model={model} filters={filters} />
    ) : null;
  // On a phone only the tab row stays pinned; the tools scroll away under
  // it (and their menus stay out of the pinned row's layer).
  const compact = isCompact(useLayout());
  return (
    <>
      <TabRow tab={tab} onTab={onTab} counts={counts}>
        {compact ? null : tools}
      </TabRow>
      {compact ? tools : null}
      <TabPanel id={WORLD_TABS} tab={tab}>
        {tab === "about" ? (
          <AboutTab world={world} backups={props.backups.view.list} />
        ) : tab === "backups" ? null : model.tracked ? (
          <ModulesTab world={world} model={model} filters={filters} />
        ) : (
          <NotSetUp world={world} />
        )}
        {/* Kept once opened: a backup can wait on Foundry's dialog for minutes. */}
        {opened || tab === "backups" ? (
          <div hidden={tab !== "backups"}>
            <BackupsTab
              world={world}
              backups={props.backups}
              changes={props.model.changes}
            />
          </div>
        ) : null}
        {tab === "modules" ? <Recent world={world} /> : null}
      </TabPanel>
    </>
  );
}
