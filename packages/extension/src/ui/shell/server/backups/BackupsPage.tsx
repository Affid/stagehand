// The server Backups page, as the prototype (design/setup-page/src/_server.js)
// in place of Foundry's Backup Manager window: the totals and free space,
// Create a snapshot (or its progress), and tabs Snapshots, Worlds, Modules
// and Systems in Foundry's order. Everything runs through Foundry's public
// calls and dialogs.
import { useState } from "preact/hooks";
import type { PackageType } from "../../../../page-backups.ts";
import type { ServerListing } from "../../../../page-server-backups.ts";
import { formatSize } from "../../../common/size.ts";
import { TabList, TabPanel } from "../../../common/tabs.tsx";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural, type Translate } from "../../../i18n.ts";
import { lockReason } from "../../../tasks.ts";
import { tip } from "../../world/backups/text.ts";
import { PageHead } from "../PageHead.tsx";
import { PackagesTab } from "./PackagesTab.tsx";
import { SnapshotDialog } from "./SnapshotDialog.tsx";
import { SnapshotJob, snapshotTask } from "./SnapshotJob.tsx";
import { SnapshotsTab } from "./SnapshotsTab.tsx";
import { type ServerBackups, useServerBackups } from "./useServerBackups.ts";

type Tab = "snapshots" | PackageType;
const TABS: readonly Tab[] = ["snapshots", "world", "module", "system"];
const BACKUP_TABS = "ml-sb";
const ICONS: Record<Tab, string> = {
  snapshots: "camera-retro",
  world: "globe",
  module: "plug",
  system: "dice",
};

const bytes = (listing: ServerListing, type?: PackageType): number =>
  listing.packages
    .filter((p) => !type || p.type === type)
    .flatMap((p) => p.backups)
    .reduce((n, b) => n + b.size, 0);

/** "4.7 GB of backups on this server · 2 snapshots · 48 GB of disk free". */
function summary(listing: ServerListing, t: Translate): string {
  return [
    t("sb.onServer", { size: formatSize(bytes(listing)) }),
    plural(t, "sb.snapCount", listing.snapshots.length),
    ...(listing.free === undefined
      ? []
      : [t("sb.free", { size: formatSize(listing.free) })]),
  ].join(" · ");
}

function count(listing: ServerListing, tab: Tab): string {
  if (tab === "snapshots") return String(listing.snapshots.length);
  const n = listing.packages
    .filter((p) => p.type === tab)
    .reduce((s, p) => s + p.backups.length, 0);
  return `${String(n)} · ${formatSize(bytes(listing, tab))}`;
}

function Tabs(props: {
  readonly listing: ServerListing;
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
}) {
  const { t } = useUi();
  return (
    <nav class="mls-subtabs">
      <TabList
        id={BACKUP_TABS}
        label={t("sb.tabs")}
        tabs={TABS}
        current={props.tab}
        onTab={props.onTab}
        render={(k) => (
          <>
            <Icon name={ICONS[k]} />
            {t(k === "snapshots" ? "sb.snapshots" : `sb.${k}`)}{" "}
            <span class="c">{count(props.listing, k)}</span>
          </>
        )}
      />
    </nav>
  );
}

function Create(props: {
  readonly off: string | null;
  readonly onCreate: () => void;
}) {
  const { t, state } = useUi();
  const job = snapshotTask(state.tasks);
  if (job) return <SnapshotJob task={job} />;
  return (
    <span class="nodel" title={tip(props.off)}>
      <button
        type="button"
        class="bright"
        disabled={props.off !== null}
        onClick={props.onCreate}
      >
        <Icon name="camera-retro" />
        {t("sb.create")}
      </button>
    </span>
  );
}

function Body(props: {
  readonly listing: ServerListing;
  readonly off: string | null;
  readonly data: ServerBackups;
}) {
  const [tab, setTab] = useState<Tab>("snapshots");
  const { listing, off, data } = props;
  return (
    <>
      <Tabs listing={listing} tab={tab} onTab={setTab} />
      <TabPanel id={BACKUP_TABS} tab={tab}>
        {tab === "snapshots" ? (
          <SnapshotsTab
            snapshots={listing.snapshots}
            off={off}
            run={(op, ids) => void data.run(op, ids)}
          />
        ) : (
          <PackagesTab
            key={tab}
            type={tab}
            packages={listing.packages.filter((p) => p.type === tab)}
            off={off}
            run={(p, op, ids) => void data.runPackage(p, op, ids)}
          />
        )}
      </TabPanel>
    </>
  );
}

export function ServerBackupsPage() {
  const { t, state, canChange } = useUi();
  const data = useServerBackups();
  const [asking, setAsking] = useState(false);
  const { view } = data;
  const off =
    lockReason(t, state) ?? (data.busy ? t("bk.busy") : canChange ? null : "");
  return (
    <div class="mlb-page ml-app">
      <PageHead
        title={t("sb.title")}
        summary={view.listing ? summary(view.listing, t) : undefined}
      >
        <Create off={off} onCreate={() => setAsking(true)} />
      </PageHead>
      {view.error ? <p class="ml-banner ml-warn">{view.error}</p> : null}
      {asking ? (
        <SnapshotDialog
          onClose={() => setAsking(false)}
          askSpace={data.askSpace}
          onCreate={(note) => {
            setAsking(false);
            void data.createSnapshot(note);
          }}
        />
      ) : null}
      {view.listing ? (
        <Body listing={view.listing} off={off} data={data} />
      ) : view.error ? null : (
        <p class="ml-empty">{t("sb.loading")}</p>
      )}
    </div>
  );
}
