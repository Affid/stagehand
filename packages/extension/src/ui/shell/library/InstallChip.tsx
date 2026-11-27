// An update's chip while it installs (updates plan): the download's
// percentage, then that it installs; before that, that it waits or is being
// backed up in a run. It takes the place of the card's update button, and
// shows on a card without one too (Foundry's own Update All finds updates
// our marks don't know).
import type { Progress } from "../../../page-progress.ts";
import { useUi } from "../../context.ts";

export function InstallChip(props: {
  readonly task?: Progress | undefined;
  /** In a run, before Foundry's install of it starts. */
  readonly waiting?: "queued" | "backup" | undefined;
  readonly title: string;
}) {
  const { t } = useUi();
  const { task, title, waiting } = props;
  const pct =
    task?.step === "download" && task.pct !== undefined ? task.pct : null;
  const text =
    pct !== null
      ? `${String(pct)}%`
      : waiting === "queued"
        ? t("lib.chip.waiting")
        : waiting === "backup"
          ? t("lib.chip.backup")
          : t("lib.chip.installing");
  const label =
    pct === null
      ? t("lib.updatingState", { title, state: text })
      : t("lib.updatingPct", { title, pct: String(pct) });
  const icon = waiting ? "fa-clock" : "fa-spinner fa-spin";
  return (
    <span
      class="stw-upd spu-chip"
      role="status"
      aria-label={label}
      title={label}
    >
      <i class={`fa-solid ${icon} fa-fw`} aria-hidden="true" />
      {text}
    </span>
  );
}
