// A world's Backups tab: Foundry's backups of this world, newest first,
// with Take a backup, Restore and Delete through Foundry's own dialogs
// (SETUP-REDESIGN.md, Backups tab). Foundry shows its own progress.
import type { WorldInfo } from "@module-library/shared/world";
import { useEffect, useState } from "preact/hooks";
import type { BackupInfo, BackupOp } from "../../../page-backups.ts";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";

const MB = 1024 * 1024;
const GB = 1024 * MB;

export function formatSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface View {
  /** Undefined until the first list arrives. */
  readonly list?: readonly BackupInfo[];
  readonly error?: string;
}

function useBackups(worldId: string) {
  const { page } = useUi();
  const [view, setView] = useState<View>({});
  const [busy, setBusy] = useState(false);
  const run = async (
    op: BackupOp,
    ids: readonly string[] = [],
  ): Promise<void> => {
    setBusy(true);
    const r = await page.backups(worldId, op, ids);
    setBusy(false);
    // A failure keeps the last list on screen, with the error above it.
    setView((v) => {
      const list = r.backups ?? v.list;
      return {
        ...(list ? { list } : {}),
        ...(r.error ? { error: r.error } : {}),
      };
    });
  };
  useEffect(() => {
    void run("list");
    // A new world gets a fresh list.
  }, [worldId]);
  return { view, busy, run };
}

function Row(props: {
  readonly b: BackupInfo;
  readonly busy: boolean;
  readonly canChange: boolean;
  readonly onRun: (op: BackupOp, ids: readonly string[]) => void;
}) {
  const { t } = useUi();
  const { b } = props;
  const when = new Date(b.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  });
  const off = props.busy || !props.canChange;
  return (
    <li data-backup={b.id}>
      <Icon name={b.snapshot ? "camera" : "floppy-disk"} />
      <span class="when">
        <strong>{when}</strong>
        {b.note ? <span class="note">{b.note}</span> : null}
        {b.snapshot ? <span class="note">{t("bk.snapshot")}</span> : null}
      </span>
      <span class="size">{formatSize(b.size)}</span>
      <button
        type="button"
        disabled={off}
        onClick={() => props.onRun("restore", [b.id])}
      >
        {t("bk.restore")}
      </button>
      {/* Disabled buttons get no hover: the reason sits on a wrapper. */}
      <span title={b.snapshot ? t("bk.snapshotHint") : undefined}>
        <button
          type="button"
          disabled={off || b.snapshot}
          onClick={() => props.onRun("delete", [b.id])}
        >
          {t("bk.delete")}
        </button>
      </span>
    </li>
  );
}

function List(props: {
  readonly list: readonly BackupInfo[];
  readonly busy: boolean;
  readonly onRun: (op: BackupOp, ids: readonly string[]) => void;
}) {
  const { t, canChange } = useUi();
  if (props.list.length === 0) return <p class="ml-empty">{t("bk.none")}</p>;
  return (
    <ul class="mlw-blist">
      {props.list.map((b) => (
        <Row
          key={b.id}
          b={b}
          busy={props.busy}
          canChange={canChange}
          onRun={props.onRun}
        />
      ))}
    </ul>
  );
}

export function BackupsTab(props: { readonly world: WorldInfo }) {
  const { t, canChange } = useUi();
  const { view, busy, run } = useBackups(props.world.id);
  const list = view.list ?? [];
  const total = list.reduce((sum, b) => sum + b.size, 0);
  return (
    <div class="mlw-backups">
      <div class="mlw-bhead">
        <span>
          {plural(t, "bk.count", list.length)}
          {list.length
            ? ` · ${t("bk.total", { size: formatSize(total) })}`
            : ""}
        </span>
        <span class="ml-spacer" />
        {busy ? <span class="ml-hint">{t("bk.busy")}</span> : null}
        <button
          type="button"
          class="ml-primary"
          disabled={busy || !canChange}
          onClick={() => void run("create")}
        >
          <Icon name="floppy-disk" />
          {t("bk.take")}
        </button>
      </div>
      <p class="ml-hint">{t("bk.lead")}</p>
      {view.error ? <p class="ml-banner ml-warn">{view.error}</p> : null}
      {view.list ? (
        <List
          list={view.list}
          busy={busy}
          onRun={(op, ids) => void run(op, ids)}
        />
      ) : view.error ? null : (
        <p class="ml-empty">{t("bk.loading")}</p>
      )}
    </div>
  );
}
