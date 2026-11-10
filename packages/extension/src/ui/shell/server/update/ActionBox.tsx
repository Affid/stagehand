// The Update box beside the notes, as the prototype (_update.js updAction):
// take a snapshot first, the button (or why it can't be used: a manual
// install, or updates turned off), the channel, and Advanced: force update.
// While it runs: the snapshot's progress, then Foundry's four steps; then
// what happens next.
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { Release } from "../../../../page-update.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { lockReason } from "../../../tasks.ts";
import { agoMs } from "../../world/backups/text.ts";
import type { UpdateState } from "./useUpdate.ts";

/** Foundry's update steps (SETUP_PACKAGE_PROGRESS.STEPS), in order. */
const STEPS = ["download", "extract", "cleanup", "install"] as const;
/** Foundry's account page with its downloads. */
export const DOWNLOADS_URL = "https://foundryvtt.com/me/licenses";

/** Foundry's four steps: done, now, still to come. */
function Steps(props: { readonly at: number }) {
  const { t } = useUi();
  const { at } = props;
  return (
    <ol class="stu-steps">
      {STEPS.map((s, i) => (
        <li key={s} class={i < at ? "done" : i === at ? "now" : ""}>
          <Icon
            name={
              i < at ? "check" : i === at ? "spinner fa-spin-pulse" : "circle"
            }
          />
          {t(`up.step.${s}`)}
        </li>
      ))}
    </ol>
  );
}

function Running(props: {
  readonly version: string;
  readonly snapshot: boolean;
}) {
  const { state, t } = useUi();
  const update = state.tasks.find((x) => x.action === "updateDownload");
  const snap = state.tasks.find(
    (x) => x.action === "createSnapshot" || x.action === "createBackup",
  );
  const snapping = props.snapshot && !update;
  const pct = (snapping ? snap?.pct : update?.pct) ?? 0;
  const at = Math.max(
    0,
    STEPS.indexOf((update?.step ?? "download") as (typeof STEPS)[number]),
  );
  return (
    <section class="stw-box stu-act">
      <h4>
        <span role="status">
          {snapping
            ? t("up.snapping")
            : t("up.updating", { version: props.version })}
        </span>
        <span>{pct}%</span>
      </h4>
      {snapping ? (
        <p class="stu-sub">
          {snap?.title ? t("up.backingUp", { title: snap.title }) : " "}
        </p>
      ) : (
        <Steps at={at} />
      )}
      <div class="stu-bar">
        <span style={{ width: `${String(pct)}%` }} />
      </div>
      <p class="hint">{t("up.locked")}</p>
    </section>
  );
}

function Done(props: { readonly version: string; readonly electron: boolean }) {
  const { t } = useUi();
  return (
    <section class="stw-box stu-act">
      <div class="stu-done">
        <Icon name="circle-check" />
        <div>
          <strong>{t("up.installedTitle", { version: props.version })}</strong>
          <span>
            {props.electron ? t("up.restarting") : t("up.shuttingDown")}
          </span>
        </div>
      </div>
    </section>
  );
}

function Why(props: { readonly children: ComponentChildren }) {
  return (
    <p class="stu-why" id="stu-why">
      <Icon name="circle-info" />
      <span>{props.children}</span>
    </p>
  );
}

function Blocked(props: {
  readonly release: Release;
  readonly manual: boolean;
}) {
  const { t, state } = useUi();
  const gen = state.data.setup?.core.version.split(".")[0];
  const newGen = String(props.release.generation) !== gen;
  return (
    <>
      <button
        type="button"
        class="bright stu-go"
        disabled
        aria-describedby="stu-why"
      >
        <Icon name={props.manual ? "hand" : "ban"} />
        {props.manual ? t("up.manualButton") : t("up.disabledButton")}
      </button>
      {props.manual ? (
        <Why>
          {newGen
            ? t("up.manualGen", { generation: props.release.generation })
            : t("up.manualFull")}{" "}
          <a href={DOWNLOADS_URL} target="_blank" rel="noopener noreferrer">
            {t("up.downloadPage")}
          </a>
        </Why>
      ) : (
        <Why>
          {t("up.disabledPre")} <code>--noupdate</code>
          {t("up.disabledPost")}
        </Why>
      )}
    </>
  );
}

function SnapshotFirst(props: {
  readonly on: boolean;
  readonly toggle: () => void;
  readonly last: number | null;
}) {
  const { t } = useUi();
  return (
    <label class="sts-bfirst">
      <input type="checkbox" checked={props.on} onChange={props.toggle} />
      <span>
        <b>{t("up.snapFirst")}</b>
        <br />
        <span class="st-muted">
          {props.last === null
            ? t("up.noSnapshot")
            : t("up.lastSnapshot", { ago: agoMs(t, props.last) })}{" "}
          {t("up.snapWhy")}
        </span>
      </span>
    </label>
  );
}

function Channel(props: { readonly u: UpdateState }) {
  const { t } = useUi();
  const { u } = props;
  const value = u.channel ?? "stable";
  return (
    <div class="stu-chan">
      <span class="k">{t("up.channelK")}</span>
      <select
        aria-label={t("up.channel")}
        value={value}
        disabled={u.job?.kind === "running"}
        onChange={(e) => {
          u.setChannel(e.currentTarget.value);
        }}
      >
        {u.env.channels.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <span class="hint">{t(`up.hint.${value}`)}</span>
    </div>
  );
}

function Force(props: { readonly on: boolean; readonly toggle: () => void }) {
  const { t } = useUi();
  const [more, setMore] = useState(false);
  const link = (
    <button
      type="button"
      class="stc-more st-link"
      aria-expanded={more}
      onClick={() => {
        setMore(!more);
      }}
    >
      {more ? t("up.fewer") : t("up.advanced")}
    </button>
  );
  if (!more) return link;
  return (
    <>
      <label class="stu-force">
        <input type="checkbox" checked={props.on} onChange={props.toggle} />
        <span>
          <b>{t("up.force")}</b>
          <br />
          <span class="st-muted">{t("up.forceHint")}</span>
        </span>
      </label>
      {link}
    </>
  );
}

function Go(props: {
  readonly version: string;
  readonly first: boolean;
  readonly electron: boolean;
  readonly onGo: () => void;
}) {
  const { t, canChange, state } = useUi();
  const { version } = props;
  // Foundry busy (a backup, a restore): the update waits (review).
  const busy = lockReason(t, state);
  return (
    <>
      <button
        type="button"
        class="bright stu-go"
        disabled={!canChange || busy !== null}
        title={busy ?? undefined}
        onClick={props.onGo}
      >
        <Icon name="cloud-arrow-down" />
        {props.first ? t("up.goSnap", { version }) : t("up.go", { version })}
      </button>
      <p class="hint">{props.electron ? t("up.goHintApp") : t("up.goHint")}</p>
    </>
  );
}

function Failed(props: { readonly error: string }) {
  const { t } = useUi();
  return (
    <p class="stu-why err" role="alert">
      <Icon name="triangle-exclamation" />
      <span>{props.error || t("up.failed")}</span>
    </p>
  );
}

function Idle(props: { readonly u: UpdateState; readonly release: Release }) {
  const { t, state } = useUi();
  const { u, release } = props;
  const [snap, setSnap] = useState(true);
  const [force, setForce] = useState(false);
  const canSnap = !u.env.noBackups;
  const disabled = state.data.setup?.coreUpdate?.canUpdate === false;
  const blocked = release.manual || disabled;
  const first = canSnap && snap;
  return (
    <section class="stw-box stu-act">
      <h4>{t("up.box")}</h4>
      {blocked || !canSnap ? null : (
        <SnapshotFirst
          on={snap}
          toggle={() => {
            setSnap(!snap);
          }}
          last={u.lastSnapshot}
        />
      )}
      {blocked ? (
        <Blocked release={release} manual={release.manual} />
      ) : (
        <Go
          version={release.version}
          first={first}
          electron={u.env.electron}
          onGo={() => void u.install(release, first, force)}
        />
      )}
      {u.job?.kind === "failed" ? <Failed error={u.job.error} /> : null}
      <Channel u={u} />
      <Force
        on={force}
        toggle={() => {
          setForce(!force);
        }}
      />
    </section>
  );
}

export function ActionBox(props: {
  readonly u: UpdateState;
  readonly release: Release;
}) {
  const { state } = useUi();
  const { u, release } = props;
  // Foundry's own ticks say an update runs, even after this page was left.
  const updating = state.tasks.some((x) => x.action === "updateDownload");
  if (u.job?.kind === "running" || updating)
    return (
      <Running
        version={release.version}
        snapshot={u.job?.kind === "running" && u.job.snapshot}
      />
    );
  if (u.job?.kind === "installed")
    return <Done version={u.job.version} electron={u.env.electron} />;
  return <Idle u={u} release={release} />;
}
