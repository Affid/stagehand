// Module Library's settings, as one small panel: the toolbar popup over any
// page, and the browser's options dialog. This site (on a Foundry page),
// servers, Release history's permission, the build.
import { useEffect, useState } from "preact/hooks";
import { foundryServerOfPage } from "../../background/servers.ts";
import { createTranslator, pickLanguage } from "../i18n.ts";
import type { SettingsPlatform, SettingsTab } from "./platform.ts";
import { ReleaseAccess } from "./ReleaseAccess.tsx";
import { ServerList } from "./ServerList.tsx";
import { ThisSite } from "./ThisSite.tsx";
import { useServers } from "./useServers.ts";

const t = createTranslator(pickLanguage("", globalThis.navigator.language));

/** The tab the panel opened over, if it shows a Foundry page. */
function useFoundryTab(platform: SettingsPlatform): SettingsTab | undefined {
  const [tab, setTab] = useState<SettingsTab | undefined>();
  useEffect(() => {
    void (async () => {
      const found = await platform.currentTab();
      // An address like Foundry's isn't enough (github.com/join): the page
      // must be Foundry's own (code review).
      if (
        found &&
        foundryServerOfPage(found.url) &&
        (await platform.isFoundry(found.id))
      )
        setTab(found);
    })().catch(() => undefined);
  }, [platform]);
  return tab;
}

export function SettingsPanel(props: { readonly platform: SettingsPlatform }) {
  const { platform } = props;
  const servers = useServers(platform);
  const tab = useFoundryTab(platform);
  const here = tab ? foundryServerOfPage(tab.url) : undefined;
  return (
    <main class="mlp">
      <h1>{t("set.title")}</h1>
      {tab && here && servers.list ? (
        <ThisSite
          t={t}
          server={here}
          tab={tab}
          on={servers.list.some((s) => s.id === here)}
          add={servers.add}
          reload={platform.reload}
        />
      ) : null}
      <ServerList t={t} s={servers} />
      <ReleaseAccess t={t} platform={platform} />
      <footer class="mlp-muted mlp-small">
        {t("set.build", { build: platform.build })}
      </footer>
    </main>
  );
}
