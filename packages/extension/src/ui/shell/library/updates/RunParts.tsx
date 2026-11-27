// The Updates tab while updates install, and after (updates plan, phase 3):
// each row's state in its right-hand column, the foot with Back up first
// and Update (or the run's progress), the summary, and what was just
// updated.
import type { Row } from "@stagehand/shared/updates/model";
import { plural } from "@stagehand/ui/i18n.ts";
import { useUi } from "../../../context.ts";
import {
  askOrStart,
  runPosition,
  setBackup,
  tickedIds,
} from "../../../package-install.ts";
import type { InstallRun } from "../../../store.ts";
import { installOf } from "../../../tasks.ts";
import { useInstallDeps } from "./useCheckDeps.ts";

/** A row's state during the run, or null when it isn't in it. */
export function RunState(props: { readonly id: string }) {
  const { state, t } = useUi();
  const run = state.install.running;
  const s = run?.states[props.id];
  if (!run || !s) return null;
  if (s === "queued" || s === "backedUp")
    return <span class="spu-st q">{t("upd.st.waiting")}</span>;
  if (s === "backup")
    return (
      <span class="spu-st">
        <i class="fa-solid fa-floppy-disk" aria-hidden="true" />
        {t("upd.st.backup")}
      </span>
    );
  if (s === "done")
    return (
      <span class="spu-st ok">
        <i class="fa-solid fa-circle-check" aria-hidden="true" />
        {t("upd.st.done")}
      </span>
    );
  if (s === "failed")
    return (
      <span class="spu-st bad">
        <i class="fa-solid fa-circle-xmark" aria-hidden="true" />
        {run.errors[props.id]?.error ?? t("upd.st.failed")}
      </span>
    );
  return <InstallingState id={props.id} />;
}

/** Foundry's install of a package: the download's percentage, then that it installs. */
export function InstallingState(props: { readonly id: string }) {
  const { state, t } = useUi();
  const task = installOf(state, props.id);
  if (task?.step === "download" && task.pct !== undefined)
    return (
      <span class="spu-st dl">
        <span class="spu-bar">
          <span style={{ width: `${String(task.pct)}%` }} />
        </span>
        {t("upd.st.download", { pct: String(task.pct) })}
      </span>
    );
  return (
    <span class="spu-st">
      <i class="fa-solid fa-spinner fa-spin" aria-hidden="true" />
      {t("upd.st.installing")}
    </span>
  );
}

/** How far the whole run is, 0 to 100. */
function runPct(run: InstallRun, current: number | undefined): number {
  const states = run.ids.map((id) => run.states[id]);
  const backingUp =
    run.backup && states.some((s) => s === "queued" || s === "backup");
  const total = run.ids.length;
  if (backingUp && !states.some((s) => s === "installing" || s === "done")) {
    const past = run.ids.filter(
      (id) => run.states[id] !== "queued" && run.states[id] !== "backup",
    ).length;
    const at = states.filter((s) => s === "backup").length;
    return Math.round(((past + at * 0.5) / total) * 100);
  }
  const finished = states.filter((s) => s === "done" || s === "failed").length;
  return Math.min(
    100,
    Math.round(((finished + (current ?? 0) / 100) / total) * 100),
  );
}

function Running(props: { readonly run: InstallRun }) {
  const { state, t } = useUi();
  const { run } = props;
  const states = run.ids.map((id) => run.states[id]);
  const backingUp =
    run.backup && !states.some((s) => s === "installing" || s === "done");
  const installing = run.ids.find((id) => run.states[id] === "installing");
  const task = installing ? installOf(state, installing) : undefined;
  const pct = runPct(run, task?.step === "download" ? task.pct : undefined);
  const { at, total } = runPosition(run);
  return (
    <div class="spu-foot busy" role="status">
      <strong>
        {backingUp
          ? plural(t, "upd.run.backup", total, { pct: String(pct) })
          : t("upd.run.installing", {
              at: String(at),
              total: String(total),
              pct: String(pct),
            })}
      </strong>
      <div class="spu-bar">
        <span style={{ width: `${String(pct)}%` }} />
      </div>
      <span class="st-muted">{t("upd.run.worldsWait")}</span>
    </div>
  );
}

/** Back up first, how many are ticked, Update; or the run's progress. */
export function UpdatesFoot(props: { readonly rows: readonly Row[] }) {
  const { state, store, t, canChange } = useUi();
  const deps = useInstallDeps();
  const run = state.install.running;
  if (run) return <Running run={run} />;
  if (
    !props.rows.some((r) => r.section === "ready" || r.section === "attention")
  )
    return null;
  const ticked = tickedIds(state);
  const n = ticked.length;
  return (
    <footer class="spu-foot">
      <label class="spu-bfirst" title={t("upd.backupHint")}>
        <input
          type="checkbox"
          checked={state.install.backup}
          onChange={(e) => {
            setBackup(store, e.currentTarget.checked);
          }}
        />
        {t("upd.backupFirst")}
      </label>
      <span class="st-spacer" />
      <span class="st-muted">
        {n ? plural(t, "upd.ticked", n) : t("upd.tickSome")}
      </span>
      <button
        type="button"
        class="bright"
        disabled={!n || !canChange}
        onClick={() => {
          askOrStart(deps, ticked);
        }}
      >
        <i class="fa-solid fa-cloud-arrow-down" aria-hidden="true" />
        {n ? t("upd.update", { n: String(n) }) : t("upd.updateNone")}
      </button>
    </footer>
  );
}

/** What the last run did, with where its backups are. */
export function UpdatesSummary() {
  const { state, store, t } = useUi();
  const last = state.install.last;
  if (!last) return null;
  const failed = last.failed.length;
  const bits = [
    plural(t, "upd.sum.ok", last.ok.length),
    ...(failed ? [t("upd.sum.failed", { n: String(failed) })] : []),
  ].join(" · ");
  return (
    <div class={`spu-sum ${failed ? "warn" : "ok"}`} role="status">
      <i
        class={`fa-solid fa-${failed ? "triangle-exclamation" : "circle-check"}`}
        aria-hidden="true"
      />
      <span>
        <strong>{bits}.</strong>
        {last.backups ? (
          <>
            {" "}
            {plural(t, "upd.sum.backups", last.ok.length + failed)}{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                store.set({ route: { kind: "server", page: "backups" } });
              }}
            >
              {t("upd.sum.backupsLink")}
            </a>
            .
          </>
        ) : null}
      </span>
      <button
        type="button"
        class="icon"
        aria-label={t("upd.sum.close")}
        title={t("upd.sum.close")}
        onClick={() => {
          store.set((s) => ({ install: { ...s.install, last: null } }));
        }}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
}

/** "Updated just now": what the last run installed, first in the list. */
export function UpdatedSection() {
  const { state, t } = useUi();
  const ok = state.install.last?.ok ?? [];
  if (!ok.length) return null;
  return (
    <li class="spu-sec updated">
      <div class="spu-sh">
        <span class="n">{t("upd.sec.updated")}</span>
        <span class="c">{ok.length}</span>
      </div>
      <ul class="spu-rows">
        {ok.map((u) => (
          <li key={u.id} class="spu-row" data-id={u.id}>
            <span />
            <i
              class={`fa-solid fa-${u.type === "system" ? "dice" : "plug"} spu-kind`}
              aria-hidden="true"
            />
            <div class="spu-main">
              <div class="l1">
                <span class="t">{u.title}</span>
                <span class="spu-ver">
                  {u.from}
                  <i class="fa-solid fa-arrow-right" aria-hidden="true" />
                  <b>{u.to}</b>
                </span>
              </div>
            </div>
            <div class="spu-side">
              <span class="spu-st ok">
                <i class="fa-solid fa-circle-check" aria-hidden="true" />
                {t("upd.st.done")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}
