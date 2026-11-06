// A world page's body: Modules and About tabs, then recent changes.
import type { WorldInfo } from "@module-library/shared/world";
import { useEffect, useState } from "preact/hooks";
import { useUi } from "../../context.ts";
import type { WorldModules } from "../../model/world-modules.ts";
import { worldRow } from "../../model/worlds.ts";
import { HistoryList } from "../../worlds/commands.tsx";
import { AboutTab } from "./AboutTab.tsx";
import { BackupsTab } from "./BackupsTab.tsx";
import { ModulesTab } from "./ModulesTab.tsx";
import { NotSetUp } from "./NotSetUp.tsx";

export type WorldTab = "modules" | "about" | "backups";
type Tab = WorldTab;
const TABS: readonly Tab[] = ["modules", "about", "backups"];

function TabBar(props: {
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
}) {
  const { t } = useUi();
  return (
    <div class="mll-tabs" role="tablist">
      {TABS.map((k) => (
        <button
          type="button"
          key={k}
          role="tab"
          aria-selected={props.tab === k}
          onClick={() => props.onTab(k)}
        >
          {t(`wt.${k}`)}
        </button>
      ))}
    </div>
  );
}

export function WorldBody(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
}) {
  const { state, t } = useUi();
  const { tab, onTab: setTab } = props;
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (tab === "backups") setOpened(true);
  }, [tab]);
  const { world, model } = props;
  const recent = worldRow(state.data, world).recent;
  return (
    <>
      <TabBar tab={tab} onTab={setTab} />
      {tab === "about" ? (
        <AboutTab world={world} />
      ) : tab === "backups" ? null : model.tracked ? (
        <ModulesTab world={world} model={model} />
      ) : (
        <NotSetUp world={world} />
      )}
      {/* Kept once opened: a backup can wait on Foundry's dialog for minutes. */}
      {opened || tab === "backups" ? (
        <div hidden={tab !== "backups"}>
          <BackupsTab world={world} />
        </div>
      ) : null}
      {tab === "modules" && recent.length ? (
        <details class="mlw-history">
          <summary>{t("wp.history")}</summary>
          <HistoryList commands={recent} />
        </details>
      ) : null}
    </>
  );
}
