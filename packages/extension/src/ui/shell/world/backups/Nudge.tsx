// While changes wait for the next launch: back up first, or it's done.
import type { WorldInfo } from "@stagehand/shared/world";
import type { BackupInfo } from "../../../../page-backups.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { pendingFor } from "../../../model/preview.ts";
import { backupAge, backupLabel, tip } from "./text.ts";

/** The latest backup, when it is newer than every waiting change. */
export function backupForQueue(
  queuedAt: readonly string[],
  latest: BackupInfo | undefined,
): BackupInfo | undefined {
  const newest = Math.max(...queuedAt.map((x) => Date.parse(x) || 0));
  return latest && latest.createdAt >= newest ? latest : undefined;
}

export function Nudge(props: {
  readonly world: WorldInfo;
  readonly changes: number;
  readonly latest: BackupInfo | undefined;
  readonly off: string | null;
  readonly onBackup: () => void;
}) {
  const { t, state } = useUi();
  const n = props.changes;
  const queuedAt = pendingFor(state.data, props.world.id).map(
    (c) => c.createdAt,
  );
  const done = backupForQueue(queuedAt, props.latest);
  if (done)
    return (
      <div class="stw-nudge done">
        <Icon name="circle-check" />
        <span>
          {t("bk.nudgeDone", {
            when: backupAge(t, done),
            changes: plural(t, "bk.changes", n),
          })}{" "}
          <b>{backupLabel(done)}</b>.
        </span>
      </div>
    );
  return (
    <div class="stw-nudge">
      <Icon name="shield-halved" />
      <span>
        <b>{plural(t, "bk.changes", n)}</b> {t("bk.nudge")}
      </span>
      <span class="nodel" title={tip(props.off)}>
        <button
          type="button"
          class="bright"
          disabled={props.off !== null}
          onClick={props.onBackup}
        >
          {t("bk.backupNow")}
        </button>
      </span>
    </div>
  );
}
