// A world page's body: Modules and About tabs, then recent changes.
import type { WorldInfo } from "@module-library/shared/world";
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

export function WorldBody(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
}) {
  const { state, t } = useUi();
  const { tab, onTab: setTab } = props;
  const { world, model } = props;
  const recent = worldRow(state.data, world).recent;
  return (
    <>
      <div class="mll-tabs" role="tablist">
        {TABS.map((k) => (
          <button
            type="button"
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
          >
            {t(`wt.${k}`)}
          </button>
        ))}
      </div>
      {tab === "about" ? (
        <AboutTab world={world} />
      ) : tab === "backups" ? (
        <BackupsTab world={world} />
      ) : model.tracked ? (
        <ModulesTab world={world} model={model} />
      ) : (
        <NotSetUp world={world} />
      )}
      {tab === "modules" && recent.length ? (
        <details class="mlw-history">
          <summary>{t("wp.history")}</summary>
          <HistoryList commands={recent} />
        </details>
      ) : null}
    </>
  );
}
