// A package with backups: its name (and whether it is still installed),
// how many and how recent, Foundry's tag of the latest, Restore latest…,
// and its backups folded under it.
import type { BackupInfo, BackupOp } from "../../../../page-backups.ts";
import type { PackageBackups } from "../../../../page-server-backups.ts";
import { formatSize } from "../../../common/size.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { BackupRow } from "../../world/backups/BackupRow.tsx";
import { backupAge, tip } from "../../world/backups/text.ts";
import { versionTag } from "./version.ts";
import { shownVersion } from "@module-library/shared/version";

export type RunPackage = (
  p: PackageBackups,
  op: BackupOp,
  ids: readonly string[],
) => void;

/** "v2.4.1 · 13.351" for a module or system; Foundry's build for a world. */
function useTag(p: PackageBackups, b: BackupInfo | undefined, row: boolean) {
  const { t, state } = useUi();
  if (!b) return null;
  const ver = p.type === "world" ? undefined : b.version;
  const text = row
    ? ver
      ? shownVersion(ver)
      : (b.verified ?? "")
    : [ver ? shownVersion(ver) : "", b.verified ?? ""]
        .filter(Boolean)
        .join(" · ");
  const gen = state.data.setup?.core.generation;
  const tag = versionTag(t, b.verified, "made", gen, text);
  return tag ?? (text ? { text, cls: "" as const, tip: "" } : null);
}

function Inner(props: {
  readonly p: PackageBackups;
  readonly off: string | null;
  readonly run: RunPackage;
}) {
  const { p } = props;
  return (
    <ol class="mlb-inner">
      {p.backups.map((b, k) => (
        <InnerRow key={b.id} {...props} b={b} latest={k === 0} />
      ))}
    </ol>
  );
}

function InnerRow(props: {
  readonly p: PackageBackups;
  readonly b: BackupInfo;
  readonly latest: boolean;
  readonly off: string | null;
  readonly run: RunPackage;
}) {
  const { p, b } = props;
  const tag = useTag(p, b, true);
  return (
    <BackupRow
      b={b}
      latest={props.latest}
      off={props.off}
      tag={tag}
      onRestore={() => props.run(p, "restore", [b.id])}
      onDelete={() => props.run(p, "delete", [b.id])}
    />
  );
}

function Name(props: {
  readonly p: PackageBackups;
  readonly onToggle: () => void;
}) {
  const { t } = useUi();
  const { p } = props;
  const latest = p.backups[0];
  return (
    <div class="nm" onClick={props.onToggle}>
      <strong>
        {p.title}
        {p.installed ? null : (
          <>
            {" "}
            <span class="mlw-pill" title={t("sb.goneTip")}>
              {t("sb.gone")}
            </span>
          </>
        )}
      </strong>
      <span>
        {plural(t, "bk.count", p.backups.length)}
        {latest
          ? ` · ${t("bk.latestAgo", { when: backupAge(t, latest) })}`
          : ""}
      </span>
    </div>
  );
}

interface PackageProps {
  readonly p: PackageBackups;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly off: string | null;
  readonly run: RunPackage;
}

function RowHead(props: PackageProps) {
  const { t } = useUi();
  const { p } = props;
  const latest = p.backups[0];
  const tag = useTag(p, latest, false);
  const restoreOff = (tag?.cls === "bad" ? tag.tip : null) ?? props.off;
  return (
    <div class="row">
      <button
        type="button"
        class="icon tog"
        aria-expanded={props.open}
        aria-label={t(props.open ? "sb.hide" : "sb.show", { title: p.title })}
        onClick={props.onToggle}
      >
        <Icon name={props.open ? "chevron-down" : "chevron-right"} />
      </button>
      <Name p={p} onToggle={props.onToggle} />
      {tag ? (
        <span class={`core ${tag.cls}`} title={tag.tip || undefined}>
          <Icon name={tag.cls ? "triangle-exclamation" : "code-branch"} />{" "}
          {tag.text}
        </span>
      ) : (
        <span />
      )}
      <span class="sz">
        {formatSize(p.backups.reduce((n, b) => n + b.size, 0))}
      </span>
      <span class="nodel" title={tip(restoreOff)}>
        <button
          type="button"
          disabled={restoreOff !== null || !latest}
          onClick={() => {
            if (latest) props.run(p, "restore", [latest.id]);
          }}
        >
          {t("sb.restoreLatest")}
        </button>
      </span>
    </div>
  );
}

export function PackageRow(props: PackageProps) {
  const { t, store } = useUi();
  const { p } = props;
  return (
    <li
      class={`mlb-pkg${props.open ? " open" : ""}`}
      data-package={`${p.type}:${p.id}`}
    >
      <RowHead {...props} />
      {props.open ? <Inner p={p} off={props.off} run={props.run} /> : null}
      {props.open && p.type === "world" && p.installed ? (
        <button
          type="button"
          class="ml-link mlb-open"
          onClick={() => {
            store.set({
              route: { kind: "world", worldId: p.id, tab: "backups" },
            });
          }}
        >
          {t("sb.openWorld", { title: p.title })}
        </button>
      ) : null}
    </li>
  );
}
