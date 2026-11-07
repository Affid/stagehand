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

export type WorldTab = "modules" | "about" | "backups";
type Tab = WorldTab;
const TABS: readonly Tab[] = ["modules", "about", "backups"];
const WORLD_TABS = "ml-wt";
const ICONS: Record<Tab, string> = {
  modules: "plug",
  about: "scroll",
  backups: "floppy-disks",
};

/** "12 on", or "14 after launch" while changes wait; Foundry's backups. */
function useCounts(model: WorldModules, backups: WorldBackups) {
  const { t } = useUi();
  const list = backups.view.list;
  return {
    modules: model.tracked
      ? model.changes
        ? t("wt.afterLaunch", { n: model.nextCount })
        : t("wt.on", { n: model.nextCount })
      : "",
    about: "",
    backups: list ? String(list.length) : "",
  } satisfies Record<Tab, string>;
}

function TabRow(props: {
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
  readonly counts: Record<Tab, string>;
  readonly children?: ComponentChildren;
}) {
  const { t } = useUi();
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
                <span class="c">{props.counts[k]}</span>
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

export function WorldBody(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly backups: WorldBackups;
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
}) {
  const { state, t } = useUi();
  const { world, model, tab, onTab } = props;
  const filters = useFilters();
  const counts = useCounts(model, props.backups);
  const opened = useOpened(tab);
  const recent = worldRow(state.data, world).recent;
  return (
    <>
      <TabRow tab={tab} onTab={onTab} counts={counts}>
        {tab === "modules" && model.tracked ? (
          <ModulesTools world={world} model={model} filters={filters} />
        ) : null}
      </TabRow>
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
        {tab === "modules" && recent.length ? (
          <details class="mlw-history">
            <summary>{t("wp.history")}</summary>
            <HistoryList commands={recent} />
          </details>
        ) : null}
      </TabPanel>
    </>
  );
}
