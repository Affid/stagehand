// The Snapshots tab: what a snapshot is, Select to delete several, and each
// snapshot with its note, when, packages, Foundry's build and size.
import { useState } from "preact/hooks";
import type {
  ServerBackupOp,
  SnapshotInfo,
} from "../../../../page-server-backups.ts";
import { formatSize } from "../../../common/size.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { agoMs, backupTime, tip } from "../../world/backups/text.ts";
import { DeleteSome } from "../../world/backups/Head.tsx";
import { versionTag } from "./version.ts";

type Run = (op: ServerBackupOp, ids: readonly string[]) => void;

const longDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function Actions(props: {
  readonly s: SnapshotInfo;
  readonly off: string | null;
  readonly bad: string | null;
  readonly run: Run;
}) {
  const { t } = useUi();
  const { s } = props;
  const restoreOff = props.bad ?? props.off;
  return (
    <>
      <span class="nodel" title={tip(restoreOff)}>
        <button
          type="button"
          disabled={restoreOff !== null}
          onClick={() => props.run("restoreSnapshot", [s.id])}
        >
          {t("bk.restore")}
        </button>
      </span>
      <span class="nodel" title={tip(props.off) ?? t("sb.deleteTip")}>
        <button
          type="button"
          class="icon"
          disabled={props.off !== null}
          aria-label={t("sb.deleteOne", {
            name: s.note ?? longDate(s.createdAt),
          })}
          onClick={() => props.run("deleteSnapshots", [s.id])}
        >
          <Icon name="trash" />
        </button>
      </span>
    </>
  );
}

function BuildTag(props: {
  readonly build: string;
  readonly cls: string;
  readonly tip: string | undefined;
}) {
  return (
    <span class={`core ${props.cls}`} title={props.tip}>
      <Icon name={props.cls ? "triangle-exclamation" : "code-branch"} />{" "}
      {props.build}
    </span>
  );
}

function SnapRow(props: {
  readonly s: SnapshotInfo;
  readonly off: string | null;
  readonly pick?: { readonly on: boolean; readonly toggle: () => void };
  readonly run: Run;
}) {
  const { t, state } = useUi();
  const { s, pick } = props;
  const build = `${String(s.generation)}.${String(s.build)}`;
  const tag = versionTag(t, build, "taken", state.data.setup?.core.generation);
  const date = longDate(s.createdAt);
  return (
    <li data-snapshot={s.id} class={pick?.on ? "picked" : ""}>
      {pick ? (
        <input
          type="checkbox"
          checked={pick.on}
          aria-label={t("sb.pick", { date })}
          onChange={pick.toggle}
        />
      ) : (
        <Icon name="camera-retro" />
      )}
      <div class="nm">
        <strong>{s.note ?? date}</strong>
        <span>
          {s.note ? `${date}, ` : ""}
          {backupTime(s.createdAt)} · {agoMs(t, s.createdAt)} ·{" "}
          {plural(t, "sb.held", s.count)}
        </span>
      </div>
      <BuildTag build={build} cls={tag?.cls ?? ""} tip={tag?.tip} />
      <span class="sz">{formatSize(s.size)}</span>
      {pick ? (
        <>
          <span />
          <span />
        </>
      ) : (
        <Actions
          s={s}
          off={props.off}
          bad={tag?.cls === "bad" ? tag.tip : null}
          run={props.run}
        />
      )}
    </li>
  );
}

function Bar(props: {
  readonly ids: readonly string[];
  readonly picked: ReadonlySet<string> | null;
  readonly off: string | null;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
}) {
  const { t } = useUi();
  const { picked } = props;
  if (!picked)
    return (
      <div class="mlw-bhead">
        <span>{t("sb.lead")}</span>
        <span class="ml-spacer" />
        {props.ids.length > 1 && props.off === null ? (
          <button type="button" onClick={props.onSelect}>
            <Icon name="square-check" />
            {t("bk.select")}
          </button>
        ) : null}
      </div>
    );
  const n = props.ids.filter((id) => picked.has(id)).length;
  return (
    <div class="mlw-bhead sel">
      <Icon name="square-check" />
      <span>
        <b>
          {n
            ? t("bk.selected", { count: plural(t, "sb.snapCount", n) })
            : t("sb.selectHint")}
        </b>
      </span>
      <span class="ml-spacer" />
      <DeleteSome n={n} off={props.off} onDelete={props.onDelete} />
      <button type="button" onClick={props.onSelect}>
        {t("bk.done")}
      </button>
    </div>
  );
}

/** Select mode: null when off, else the snapshots picked. */
function usePicked() {
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const toggle = (id: string): void => {
    setPicked((p) =>
      p?.has(id)
        ? new Set([...p].filter((x) => x !== id))
        : new Set([...(p ?? []), id]),
    );
  };
  const flip = (): void => {
    setPicked((p) => (p ? null : new Set()));
  };
  return { picked, toggle, flip, done: () => setPicked(null) };
}

export function SnapshotsTab(props: {
  readonly snapshots: readonly SnapshotInfo[];
  readonly off: string | null;
  readonly run: Run;
}) {
  const { t } = useUi();
  const { picked, toggle, flip, done } = usePicked();
  const { snapshots } = props;
  if (!snapshots.length)
    return (
      <div class="mlw-empty">
        <Icon name="camera-retro" />
        <h3>{t("sb.noneTitle")}</h3>
        <p>{t("sb.noneText")}</p>
      </div>
    );
  const del = (): void => {
    const ids = snapshots.filter((s) => picked?.has(s.id)).map((s) => s.id);
    done();
    props.run("deleteSnapshots", ids);
  };
  return (
    <div class="mlb-scroll">
      <Bar
        ids={snapshots.map((s) => s.id)}
        picked={picked}
        off={props.off}
        onSelect={flip}
        onDelete={del}
      />
      <ol class="mlw-blist mlb-snaps">
        {snapshots.map((s) => (
          <SnapRow
            key={s.id}
            s={s}
            off={props.off}
            run={props.run}
            {...(picked
              ? { pick: { on: picked.has(s.id), toggle: () => toggle(s.id) } }
              : {})}
          />
        ))}
      </ol>
    </div>
  );
}
