// A world's About tab, as the prototype: description, next session and
// details on the left; background, maintenance and the danger zone on the
// right. Every edit goes through Foundry's own requests.
import type { WorldInfo } from "@stagehand/shared/world";
import { useUi } from "../../context.ts";
import type { BackupInfo } from "../../../page-backups.ts";
import { useCanEditWorld } from "./AboutEdit.tsx";
import { SessionBox } from "./about/session/SessionBox.tsx";
import { DescriptionBox } from "./about/DescriptionBox.tsx";
import { Details } from "./about/Details.tsx";
import { Background, DangerZone, Maintenance } from "./about/Side.tsx";

/** Edits need the editWorld flag, a verified admin, and an unlocked world. */
function useEditing(world: WorldInfo) {
  const { state, canChange } = useUi();
  const canEdit = useCanEditWorld() && world.locked !== true;
  const a = state.adapter;
  const canLock =
    canChange &&
    a.status !== "safe-mode" &&
    a.adapter.flags.lockPackage === true;
  return { canEdit, canLock };
}

/** The About tab, as the prototype: two columns of boxes. */
export function AboutTab(props: {
  readonly world: WorldInfo;
  readonly backups: readonly BackupInfo[] | undefined;
}) {
  const { t } = useUi();
  const { world, backups } = props;
  const { canEdit, canLock } = useEditing(world);
  const side = { world, canEdit, canLock, backups };
  return (
    <div class="stw-about">
      <div class="col">
        <DescriptionBox world={world} canEdit={canEdit} />
        <SessionBox world={world} canEdit={canEdit} />
        <Details world={world} canEdit={canEdit} backups={backups} />
      </div>
      <div class="col">
        <Background {...side} />
        <Maintenance {...side} />
        <DangerZone {...side} />
        {world.locked ? <p class="hint">{t("about.lockedHint")}</p> : null}
        <p class="hint">{t("about.insideWorld")}</p>
      </div>
    </div>
  );
}
