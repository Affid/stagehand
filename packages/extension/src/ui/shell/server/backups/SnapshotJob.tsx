// A snapshot as Foundry takes it: modules, then systems, then worlds (its
// own order, seen live on 14.370), the package it is on, and the percent.
import type { Progress } from "../../../../page-progress.ts";
import { useUi } from "../../../context.ts";

const STEPS = ["snapshotModules", "snapshotSystems", "snapshotWorlds"];
const LABELS = ["sb.module", "sb.system", "sb.world"];

/** The snapshot under way, if any. */
export const snapshotTask = (
  tasks: readonly Progress[],
): Progress | undefined => tasks.find((x) => x.action === "createSnapshot");

/** Each step counts for a third. */
export function overall(task: Progress): number {
  const i = Math.max(0, STEPS.indexOf(task.step ?? ""));
  return Math.round((i * 100 + (task.pct ?? 0)) / STEPS.length);
}

function StepIcon(props: { readonly state: "done" | "now" | "" }) {
  const name =
    props.state === "done"
      ? "fa-check"
      : props.state === "now"
        ? "fa-spinner fa-spin-pulse"
        : "fa-circle";
  return <i class={`fa-solid ${name}`} aria-hidden="true" />;
}

export function SnapshotJob(props: { readonly task: Progress }) {
  const { t, state } = useUi();
  const at = Math.max(0, STEPS.indexOf(props.task.step ?? ""));
  const pct = overall(props.task);
  const current = [...state.tasks]
    .reverse()
    .find((x) => x.action === "createBackup" && x.title);
  return (
    <div class="mlb-job" role="status" title={t("sb.jobTip")}>
      <div class="t">
        <strong>{t("sb.job", { pct: String(pct) })}</strong>
        <span>
          {current?.title
            ? t("sb.jobOn", { title: current.title })
            : t("sb.jobStart")}
        </span>
      </div>
      <ol>
        {LABELS.map((label, i) => {
          const s = i < at ? "done" : i === at ? "now" : "";
          return (
            <li key={label} class={s}>
              <StepIcon state={s} />
              {t(label)}
            </li>
          );
        })}
      </ol>
      <div class="bar">
        <span style={{ width: `${String(pct)}%` }} />
      </div>
      <span class="pct">{pct}%</span>
    </div>
  );
}
