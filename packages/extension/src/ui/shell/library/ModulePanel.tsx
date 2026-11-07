// A module's details in their own column beside the Library or a world's
// page: its Library tab (ours: folder, tags, note, presets, worlds) and its
// Package tab (PackageTab.tsx: Foundry's manifest and its own actions).
import type { PackageInfo } from "@module-library/shared/package";
import { useState } from "preact/hooks";
import { TabList, TabPanel } from "../../common/tabs.tsx";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { LibraryTab } from "./LibraryTab.tsx";
import { PackageTab } from "./PackageTab.tsx";
import { shownVersion } from "@module-library/shared/version";

type Tab = "library" | "package";
const TABS: readonly Tab[] = ["library", "package"];
const PANEL_TABS = "ml-mp";

/** "modular-av · v0.11.0 · Andrei Fedorov". */
function Sub(props: { readonly pkg: PackageInfo }) {
  const { pkg } = props;
  const authors = pkg.authors.map((a) => a.name).join(", ");
  return (
    <div class="sub">
      {[pkg.id, shownVersion(pkg.version), authors].filter(Boolean).join(" · ")}
    </div>
  );
}

const TAB_ICON: Record<Tab, string> = { library: "books", package: "box-open" };

function PanelTabs(props: {
  readonly title: string;
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
}) {
  const { t } = useUi();
  return (
    <nav class="mls-subtabs">
      <TabList
        id={PANEL_TABS}
        label={t("mp.tabs", { title: props.title })}
        tabs={TABS}
        current={props.tab}
        onTab={props.onTab}
        render={(k) => (
          <>
            <Icon name={TAB_ICON[k]} />
            {t(`mp.tab.${k}`)}
          </>
        )}
      />
    </nav>
  );
}

/** The details column, as the prototype: "Module", the name, two tabs. */
export function ModulePanel(props: {
  readonly pkg: PackageInfo;
  /** The world whose page is open, marked in the worlds list. */
  readonly here?: string | undefined;
  readonly onClose: () => void;
}) {
  const { t } = useUi();
  const [tab, setTab] = useState<Tab>("library");
  const { pkg } = props;
  return (
    <aside class="application framed mls-panel ml-app" aria-label={pkg.title}>
      <h2 class="divider">{t("mp.title")}</h2>
      <button
        type="button"
        class="icon mls-close"
        aria-label={t("mp.close")}
        title={t("mp.close")}
        onClick={props.onClose}
      >
        <Icon name="xmark" />
      </button>
      <div class="scroll">
        <div class="mls-modhead">
          <h3>{pkg.title}</h3>
          <Sub pkg={pkg} />
        </div>
        <PanelTabs title={pkg.title} tab={tab} onTab={setTab} />
        <TabPanel id={PANEL_TABS} tab={tab}>
          {tab === "library" ? (
            <LibraryTab pkg={pkg} here={props.here} />
          ) : (
            <PackageTab pkg={pkg} />
          )}
        </TabPanel>
      </div>
    </aside>
  );
}
