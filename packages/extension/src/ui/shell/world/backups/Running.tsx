// Foundry's backup or restore of this world, as it runs (Foundry draws its
// own bar inside its hidden layout, so we draw ours).
import type { Progress } from "../../../../page-progress.ts";
import { useUi } from "../../../context.ts";

const SHOWN: ReadonlySet<string> = new Set(["createBackup", "restoreBackup"]);

export const runningHere = (tasks: readonly Progress[]): Progress[] =>
  tasks.filter((x) => SHOWN.has(x.action));

export function Running(props: {
  readonly task: Progress;
  readonly title: string;
}) {
  const { t } = useUi();
  const { task } = props;
  const verb =
    task.action === "restoreBackup" ? "bk.restoring" : "bk.backingUp";
  return (
    <li class="busy" role="status">
      <i class="fa-solid fa-spinner fa-spin-pulse" aria-hidden="true" />
      <div class="nm">
        <strong>{t(verb, { title: props.title })}</strong>
        <span>{t("bk.waitNote")}</span>
      </div>
      <div class="bar">
        <span style={{ width: `${String(task.pct ?? 0)}%` }} />
      </div>
      <span class="sz">
        {task.pct === undefined ? "" : `${String(task.pct)}%`}
      </span>
    </li>
  );
}
