// A world's About tab, as the prototype: description, next session and
// details on the left; background, maintenance and the danger zone on the
// right. Every edit goes through Foundry's own requests.
import type { WorldInfo } from "@module-library/shared/world";
import { useUi } from "../../context.ts";
import type { BackupInfo } from "../../../page-backups.ts";
import { SessionField, useCanEditWorld } from "./AboutEdit.tsx";
import { DescriptionBox } from "./about/DescriptionBox.tsx";
import { Details } from "./about/Details.tsx";
import { Background, DangerZone, Maintenance } from "./about/Side.tsx";

/** "Thursday, 12 November 2026 at 19:00 CET", or undefined if unreadable. */
export function formatSession(
  iso: string | undefined,
  lang?: string,
): string | undefined {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return undefined;
  // dateStyle can't be combined with timeZoneName: spell the parts out.
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat(
      lang === "" ? undefined : lang,
      options,
    ).format(t);
  } catch {
    // An odd language tag (e.g. "pt_BR") falls back to the browser's.
    return new Intl.DateTimeFormat(undefined, options).format(t);
  }
}

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

function NextSession(props: {
  readonly world: WorldInfo;
  readonly canEdit: boolean;
}) {
  const { state, t } = useUi();
  const shown = formatSession(props.world.nextSession, state.data.setup?.lang);
  return (
    <section class="mlw-box">
      <h4>
        <span>{t("about.nextBox")}</span>
      </h4>
      <div class="mlw-next">
        {props.canEdit ? (
          <SessionField world={props.world} />
        ) : (
          (shown ?? t("about.notSet"))
        )}
      </div>
    </section>
  );
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
    <div class="mlw-about">
      <div class="col">
        <DescriptionBox world={world} canEdit={canEdit} />
        <NextSession world={world} canEdit={canEdit} />
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
