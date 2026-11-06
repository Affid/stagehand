// The Backups tab's head: a summary with Select and Take a backup, or, while
// selecting, what is picked and Delete.
import type { BackupInfo } from "../../../../page-backups.ts";
import { Icon } from "../../../common/widgets.tsx";
import { formatSize } from "../../../common/size.ts";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { backupAge, tip } from "./text.ts";

const sizeOf = (list: readonly BackupInfo[]): number =>
  list.reduce((n, b) => n + b.size, 0);

export function SummaryHead(props: {
  readonly list: readonly BackupInfo[];
  readonly off: string | null;
  /** The nudge offers Back up now instead. */
  readonly nudged: boolean;
  readonly onSelect: () => void;
  readonly onTake: () => void;
}) {
  const { t } = useUi();
  const { list, off } = props;
  const latest = list[0];
  const deletable = list.filter((b) => !b.snapshot).length;
  return (
    <div class="mlw-bhead">
      <span>
        <b>{plural(t, "bk.count", list.length)}</b>
        {latest
          ? ` · ${t("bk.latestAgo", { when: backupAge(t, latest) })}`
          : ""}
        {` · ${t("bk.total", { size: formatSize(sizeOf(list)) })}`}
      </span>
      <span class="ml-spacer" />
      {deletable > 1 ? (
        <button type="button" disabled={off !== null} onClick={props.onSelect}>
          <Icon name="square-check" />
          {t("bk.select")}
        </button>
      ) : null}
      {props.nudged ? null : (
        <span class="nodel" title={tip(off)}>
          <button
            type="button"
            class="bright"
            disabled={off !== null}
            onClick={props.onTake}
          >
            <Icon name="floppy-disk" />
            {t("bk.take")}
          </button>
        </span>
      )}
    </div>
  );
}

export function SelectHead(props: {
  readonly list: readonly BackupInfo[];
  readonly picked: ReadonlySet<string>;
  readonly off: string | null;
  readonly onAll: () => void;
  readonly onDelete: () => void;
  readonly onDone: () => void;
}) {
  const { t } = useUi();
  const n = props.picked.size;
  const frees = sizeOf(props.list.filter((b) => props.picked.has(b.id)));
  return (
    <div class="mlw-bhead sel">
      <Icon name="square-check" />
      <span>
        <b>
          {n
            ? t("bk.selected", { count: plural(t, "bk.count", n) })
            : t("bk.selectHint")}
        </b>
        {n ? ` · ${t("bk.frees", { size: formatSize(frees) })}` : ""}
      </span>
      <button type="button" onClick={props.onAll}>
        {t("bk.all")}
      </button>
      <span class="ml-spacer" />
      <button
        type="button"
        class="del"
        disabled={n === 0 || props.off !== null}
        onClick={props.onDelete}
      >
        <Icon name="trash" />
        {n ? t("bk.deleteN", { n: String(n) }) : t("bk.deleteSome")}
      </button>
      <button type="button" onClick={props.onDone}>
        {t("bk.done")}
      </button>
    </div>
  );
}
