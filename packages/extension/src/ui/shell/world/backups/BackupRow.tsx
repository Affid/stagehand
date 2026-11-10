// One of Foundry's backups: its name, when, the latest pill, Foundry's
// version badge, size, Restore… and Delete (or a box to pick it).
import type { BackupInfo } from "../../../../page-backups.ts";
import { Icon } from "../../../common/widgets.tsx";
import { formatSize } from "../../../common/size.ts";
import { useUi } from "../../../context.ts";
import {
  backupAge,
  backupDate,
  backupLabel,
  backupTime,
  olderCore,
  tip,
} from "./text.ts";

/** Foundry's version tag on a row: older warns; newer can't be restored. */
export interface Tag {
  readonly text: string;
  readonly cls: "" | "warn" | "bad";
  readonly tip: string;
}

export interface RowProps {
  readonly b: BackupInfo;
  readonly latest: boolean;
  /** Why Restore and Delete are off right now, if they are. */
  readonly off: string | null;
  /** Select mode: whether it is picked, and how to pick it. */
  readonly pick?: { readonly on: boolean; readonly toggle: () => void };
  readonly onRestore: () => void;
  readonly onDelete: () => void;
  /** The server page's tag in place of Foundry's badge. */
  readonly tag?: Tag | null;
}

function Pick(props: RowProps) {
  const { t } = useUi();
  const { b, pick } = props;
  if (!pick) return <Icon name={b.snapshot ? "camera" : "floppy-disk"} />;
  if (b.snapshot)
    return (
      <span class="nodel" title={t("bk.snapPick")}>
        <input type="checkbox" disabled aria-label={t("bk.snapPickLabel")} />
      </span>
    );
  return (
    <input
      type="checkbox"
      checked={pick.on}
      aria-label={t("bk.pick", { name: backupLabel(b) })}
      onChange={pick.toggle}
    />
  );
}

function Name(props: { readonly b: BackupInfo; readonly latest: boolean }) {
  const { t } = useUi();
  const { b } = props;
  return (
    <div class="nm">
      <strong>{backupLabel(b)}</strong>
      <span>
        {backupDate(b.createdAt)}, {backupTime(b.createdAt)} · {backupAge(t, b)}
        {b.snapshot ? ` · ${t("bk.inSnapshot")}` : ""}
        {props.latest ? (
          <>
            {" "}
            <span class="stw-pill">{t("bk.latest")}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}

function Core(props: {
  readonly b: BackupInfo;
  readonly tag?: Tag | null | undefined;
}) {
  const { t, state } = useUi();
  const { b, tag } = props;
  if (tag)
    return (
      <span class={`core ${tag.cls}`} title={tag.tip}>
        <Icon name={tag.cls ? "triangle-exclamation" : "code-branch"} />{" "}
        {tag.text}
      </span>
    );
  if (!b.verified || tag === null) return <span />;
  const old = olderCore(b, state.data.setup?.core.generation);
  return (
    <span
      class={`core${old ? " warn" : ""}`}
      title={t(old ? "bk.coreOld" : "bk.coreOk")}
    >
      <Icon name="code-branch" /> {b.verified}
    </span>
  );
}

function Delete(props: RowProps) {
  const { t, canChange } = useUi();
  const { b } = props;
  if (b.snapshot)
    return (
      <span class="nodel" title={t("bk.snapshotHint")}>
        <button
          type="button"
          class="icon"
          disabled
          aria-label={t("bk.snapDelLabel")}
        >
          <Icon name="trash" />
        </button>
      </span>
    );
  const off = props.off ?? (canChange ? null : "");
  return (
    <span class="nodel" title={tip(off) ?? t("bk.delete")}>
      <button
        type="button"
        class="icon"
        disabled={off !== null}
        aria-label={t("bk.deleteNamed", { name: backupLabel(b) })}
        onClick={props.onDelete}
      >
        <Icon name="trash" />
      </button>
    </span>
  );
}

export function BackupRow(props: RowProps) {
  const { t, canChange } = useUi();
  const { b, pick } = props;
  const bad = props.tag?.cls === "bad" ? props.tag.tip : null;
  const off = bad ?? props.off ?? (canChange ? null : "");
  return (
    <li
      data-backup={b.id}
      class={`${props.latest ? "latest" : ""}${pick?.on ? " picked" : ""}`}
    >
      <Pick {...props} />
      <Name b={b} latest={props.latest} />
      <Core b={b} tag={props.tag} />
      <span class="sz">{formatSize(b.size)}</span>
      {pick ? (
        <>
          <span />
          <span />
        </>
      ) : (
        <>
          {/* Disabled buttons get no hover: the reason sits on a wrapper. */}
          <span class="nodel" title={tip(off)}>
            <button
              type="button"
              disabled={off !== null}
              onClick={props.onRestore}
            >
              {t("bk.restore")}
            </button>
          </span>
          <Delete {...props} />
        </>
      )}
    </li>
  );
}
