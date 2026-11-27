// An update's chip while Foundry installs it (updates plan, phase 1): the
// download's percentage, then that it installs. It takes the place of the
// card's update button, and shows on a card without one too (Foundry's
// Update All finds updates our marks don't know).
import type { Progress } from "../../../page-progress.ts";
import { useUi } from "../../context.ts";

export function InstallChip(props: {
  readonly task: Progress;
  readonly title: string;
}) {
  const { t } = useUi();
  const { task, title } = props;
  const pct =
    task.step === "download" && task.pct !== undefined ? task.pct : null;
  const label =
    pct === null
      ? t("lib.updatingInstall", { title })
      : t("lib.updatingPct", { title, pct: String(pct) });
  return (
    <span
      class="stw-upd spu-chip"
      role="status"
      aria-label={label}
      title={label}
    >
      <i class="fa-solid fa-spinner fa-spin fa-fw" aria-hidden="true" />
      {pct === null ? t("lib.chip.installing") : `${String(pct)}%`}
    </span>
  );
}
