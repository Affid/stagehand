// The server Backups page (SETUP-REDESIGN.md: Server backups), instead of
// Foundry's Backup Manager window: Snapshots, then Worlds, Modules and
// Systems in Foundry's order, each package's backups inline. Everything
// runs through Foundry's public calls and dialogs.
import { useEffect, useState } from "preact/hooks";
import type { BackupOp, PackageType } from "../../../page-backups.ts";
import type {
  PackageBackups,
  ServerBackupOp,
  ServerListing,
  SnapshotInfo,
} from "../../../page-server-backups.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural, type Translate } from "../../i18n.ts";
import { formatSize } from "../../common/size.ts";
import { BackupRow } from "../world/backups/BackupRow.tsx";
import { PageHead } from "./PageHead.tsx";

const TYPES: readonly PackageType[] = ["world", "module", "system"];

interface View {
  readonly listing?: ServerListing;
  readonly error?: string;
}

function useServerBackups() {
  const { page } = useUi();
  const [view, setView] = useState<View>({});
  const [busy, setBusy] = useState(false);
  const settle = (r: View): void => {
    setView((v) => {
      const listing = r.listing ?? v.listing;
      return {
        ...(listing ? { listing } : {}),
        ...(r.error ? { error: r.error } : {}),
      };
    });
  };
  const run = async (
    op: ServerBackupOp,
    ids: readonly string[] = [],
  ): Promise<void> => {
    setBusy(true);
    settle(await page.serverBackups(op, ids));
    setBusy(false);
  };
  /** A package's backup, then the whole listing again. */
  const runPackage = async (
    p: PackageBackups,
    op: BackupOp,
    ids: readonly string[],
  ): Promise<void> => {
    setBusy(true);
    const r = await page.backups(p.id, op, ids, p.type);
    const list = await page.serverBackups("list", []);
    // The operation's error stays visible after the list comes back.
    settle({ ...list, ...(r.error ? { error: r.error } : {}) });
    setBusy(false);
  };
  useEffect(() => {
    void run("list");
  }, []);
  return { view, busy, run, runPackage };
}

function Snapshot(props: {
  readonly s: SnapshotInfo;
  readonly busy: boolean;
  readonly onRun: (op: ServerBackupOp, ids: readonly string[]) => void;
}) {
  const { t, canChange } = useUi();
  const { s } = props;
  const off = props.busy || !canChange;
  const when = new Date(s.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  });
  return (
    <li data-snapshot={s.id}>
      <Icon name="camera" />
      <span class="when">
        <strong>{when}</strong>
        <span class="note">
          {[
            s.note,
            t("sb.version", {
              version: `${String(s.generation)}.${String(s.build)}`,
            }),
            plural(t, "sb.held", s.count),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span class="size">{formatSize(s.size)}</span>
      <button
        type="button"
        disabled={off}
        onClick={() => props.onRun("restoreSnapshot", [s.id])}
      >
        {t("bk.restore")}
      </button>
      <button
        type="button"
        disabled={off}
        onClick={() => props.onRun("deleteSnapshots", [s.id])}
      >
        {t("bk.delete")}
      </button>
    </li>
  );
}

function PackageHead(props: {
  readonly p: PackageBackups;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const { t } = useUi();
  const { p } = props;
  const size = p.backups.reduce((n, b) => n + b.size, 0);
  return (
    <button
      type="button"
      class="mlb-pkghead"
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <i
        class={`fa-solid fa-chevron-${props.open ? "down" : "right"} fa-fw`}
        aria-hidden="true"
      />
      <strong>{p.title}</strong>
      {p.installed ? null : (
        <span class="mlb-gone">{t("sb.notInstalled")}</span>
      )}
      <span class="ml-spacer" />
      <span class="note">
        {t("sb.summary", {
          count: plural(t, "bk.count", p.backups.length),
          size: formatSize(size),
        })}
      </span>
    </button>
  );
}

function Package(props: {
  readonly p: PackageBackups;
  readonly busy: boolean;
  readonly onRun: (
    p: PackageBackups,
    op: BackupOp,
    ids: readonly string[],
  ) => void;
}) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const { p } = props;
  return (
    <li class="mlb-pkg" data-package={`${p.type}:${p.id}`}>
      <PackageHead p={p} open={open} onToggle={() => setOpen(!open)} />
      {open ? (
        <ul class="mlw-blist">
          {p.backups.map((b) => (
            <BackupRow
              key={b.id}
              b={b}
              latest={false}
              off={props.busy ? t("bk.busy") : null}
              onRestore={() => props.onRun(p, "restore", [b.id])}
              onDelete={() => props.onRun(p, "delete", [b.id])}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SnapshotSection(props: {
  readonly listing: ServerListing;
  readonly busy: boolean;
  readonly run: (op: ServerBackupOp, ids: readonly string[]) => void;
}) {
  const { t } = useUi();
  const { snapshots } = props.listing;
  const size = snapshots.reduce((n, s) => n + s.size, 0);
  return (
    <section class="mlb-sec">
      <h3>
        {t("sb.snapshots")}{" "}
        <span class="note">
          {t("sb.summary", {
            count: String(snapshots.length),
            size: formatSize(size),
          })}
        </span>
      </h3>
      {snapshots.length ? (
        <ul class="mlw-blist mlb-snaps">
          {snapshots.map((s) => (
            <Snapshot key={s.id} s={s} busy={props.busy} onRun={props.run} />
          ))}
        </ul>
      ) : (
        <p class="ml-empty mlb-snaps">{t("sb.noSnapshots")}</p>
      )}
    </section>
  );
}

function Sections(props: {
  readonly listing: ServerListing;
  readonly busy: boolean;
  readonly run: (op: ServerBackupOp, ids: readonly string[]) => void;
  readonly runPackage: (
    p: PackageBackups,
    op: BackupOp,
    ids: readonly string[],
  ) => void;
}) {
  const { t } = useUi();
  const { listing } = props;
  return (
    <>
      <SnapshotSection listing={listing} busy={props.busy} run={props.run} />
      {TYPES.map((type) => {
        const pkgs = listing.packages.filter((p) => p.type === type);
        if (pkgs.length === 0) return null;
        return (
          <section class="mlb-sec" key={type}>
            <h3>
              {t(`sb.${type}`)} <span class="note">{pkgs.length}</span>
            </h3>
            <ul class="mlb-pkgs">
              {pkgs.map((p) => (
                <Package
                  key={p.id}
                  p={p}
                  busy={props.busy}
                  onRun={props.runPackage}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** "4.7 GB of backups on this server · 2 snapshots". */
function summary(listing: ServerListing, t: Translate): string {
  const bytes = listing.packages
    .flatMap((p) => p.backups)
    .reduce((n, b) => n + b.size, 0);
  return t("sb.headSummary", {
    size: formatSize(bytes),
    snapshots: plural(t, "sb.snapCount", listing.snapshots.length),
  });
}

export function ServerBackupsPage() {
  const { t, canChange } = useUi();
  const { view, busy, run, runPackage } = useServerBackups();
  return (
    <div class="mlb-page ml-app">
      <PageHead
        title={t("sb.title")}
        summary={view.listing ? summary(view.listing, t) : undefined}
      >
        {busy ? <span class="ml-hint">{t("bk.busy")}</span> : null}
        <button
          type="button"
          class="ml-primary"
          disabled={busy || !canChange}
          onClick={() => void run("createSnapshot")}
        >
          <Icon name="camera" />
          {t("sb.take")}
        </button>
      </PageHead>
      <p class="ml-hint">{t("sb.lead")}</p>
      {view.error ? <p class="ml-banner ml-warn">{view.error}</p> : null}
      {view.listing ? (
        <Sections
          listing={view.listing}
          busy={busy}
          run={(op, ids) => void run(op, ids)}
          runPackage={(p, op, ids) => void runPackage(p, op, ids)}
        />
      ) : view.error ? null : (
        <p class="ml-empty">{t("sb.loading")}</p>
      )}
    </div>
  );
}
