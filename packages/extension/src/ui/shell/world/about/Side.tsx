// The About tab's right column, as the prototype: Background (Foundry's
// file picker), Maintenance (data, safe mode, reset passwords, lock) and the
// Danger zone (Foundry's own delete dialog).
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import type { BackupInfo } from "../../../../page-backups.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { cssImage } from "../../route.ts";
import { useSave } from "../AboutEdit.tsx";
import { isOlder } from "./format.ts";

export interface SideProps {
  readonly world: WorldInfo;
  /** Edits through editWorld: a verified admin, the flag, not locked. */
  readonly canEdit: boolean;
  /** Lock and unlock through lockPackage: a verified admin and the flag. */
  readonly canLock: boolean;
  readonly backups: readonly BackupInfo[] | undefined;
}

/** A disabled control's reason, on a wrapper that gets the hover. */
function Why(props: {
  readonly why: string | undefined;
  readonly children: preact.ComponentChildren;
}) {
  return props.why ? (
    <span class="mlw-tipwrap" title={props.why}>
      {props.children}
    </span>
  ) : (
    <>{props.children}</>
  );
}

export function Background(props: SideProps) {
  const { page, t } = useUi();
  const image = cssImage(props.world.background, location.origin);
  return (
    <section class="mlw-box">
      <h4>
        <span>{t("about.background")}</span>
        {props.canEdit ? (
          <button
            type="button"
            class="ml-link"
            aria-label={t("about.changeBackground")}
            onClick={() =>
              page.foundryAction({
                action: "pickBackground",
                worldId: props.world.id,
              })
            }
          >
            {t("about.change")}
          </button>
        ) : null}
      </h4>
      {image ? (
        <div class="mlw-bg" style={{ "--img": image }} />
      ) : (
        <p class="ml-muted">{t("about.noBackground")}</p>
      )}
      <p class="hint">{t("about.backgroundHint")}</p>
    </section>
  );
}

function DataRow(props: { readonly world: WorldInfo }) {
  const { state, t } = useUi();
  const core = state.data.setup?.core;
  const old = isOlder(props.world.coreVersion, core?.generation ?? 0);
  return old ? (
    <li class="warn info">
      <div>
        <strong>{t("about.migrates")}</strong>
        <span>
          {t("about.migratesHint", {
            saved: props.world.coreVersion,
            core: core?.version ?? "",
          })}
        </span>
      </div>
      <Icon name="circle-info" />
    </li>
  ) : (
    <li class="ok">
      <div>
        <strong>{t("about.data")}</strong>
        <span>
          {t("about.dataOk", { generation: String(core?.generation ?? "") })}
        </span>
      </div>
      <Icon name="circle-check" />
    </li>
  );
}

function ResetConfirm(props: {
  readonly world: WorldInfo;
  readonly onDone: () => void;
}) {
  const { actions, t } = useUi();
  const save = useSave(props.world.id);
  const reset = (): void => {
    void save({ resetKeys: true }).then((ok) => {
      if (!ok) return;
      props.onDone();
      actions.notify(
        "info",
        t("about.resetDone", { world: props.world.title }),
      );
    });
  };
  return (
    <li class="confirm">
      <div>
        <strong>{t("about.resetAsk")}</strong>
        <span>{t("about.resetAskHint")}</span>
      </div>
      <button type="button" onClick={props.onDone}>
        {t("about.cancel")}
      </button>
      <button type="button" class="del" onClick={reset}>
        {t("about.resetGo")}
      </button>
    </li>
  );
}

function ResetRow(props: SideProps) {
  const { t } = useUi();
  const [asking, setAsking] = useState(false);
  const locked = props.world.locked === true;
  if (asking)
    return <ResetConfirm world={props.world} onDone={() => setAsking(false)} />;
  return (
    <li>
      <div>
        <strong>{t("about.reset")}</strong>
        <span>{t("about.resetHint")}</span>
      </div>
      <Why why={locked ? t("about.unlockFirst") : undefined}>
        <button
          type="button"
          disabled={!props.canEdit}
          onClick={() => setAsking(true)}
        >
          {t("about.resetOpen")}
        </button>
      </Why>
    </li>
  );
}

function Switch(props: {
  readonly label: string;
  readonly hint: string;
  readonly on: boolean;
  readonly disabled: boolean;
  readonly why?: string | undefined;
  readonly onChange: (on: boolean) => void;
}) {
  return (
    <li>
      <div>
        <strong>{props.label}</strong>
        <span>{props.hint}</span>
      </div>
      <Why why={props.why}>
        <input
          type="checkbox"
          role="switch"
          class="mls-switch"
          aria-label={props.label}
          checked={props.on}
          disabled={props.disabled}
          onClick={(e) => {
            e.preventDefault();
            props.onChange(!props.on);
          }}
        />
      </Why>
    </li>
  );
}

export function Maintenance(props: SideProps) {
  const { page, t } = useUi();
  const { world } = props;
  const save = useSave(world.id);
  const locked = world.locked === true;
  const safe = world.safeMode === true;
  return (
    <section class="mlw-box">
      <h4>
        <span>{t("about.maintenance")}</span>
      </h4>
      <ul class="mlw-acts">
        <DataRow world={world} />
        <Switch
          label={t("about.safe")}
          hint={safe ? t("about.safeOn") : t("about.safeOff")}
          on={safe}
          disabled={!props.canEdit}
          why={locked ? t("about.unlockFirst") : undefined}
          onChange={(on) => void save({ safeMode: on })}
        />
        <ResetRow {...props} />
        <Switch
          label={t("about.lock")}
          hint={locked ? t("about.lockedHint") : t("about.lockHint")}
          on={locked}
          disabled={!props.canLock}
          onChange={(on) =>
            page.foundryAction({
              action: on ? "lock" : "unlock",
              worldId: world.id,
            })
          }
        />
      </ul>
    </section>
  );
}

export function DangerZone(props: SideProps) {
  const { page, t, canChange } = useUi();
  const locked = props.world.locked === true;
  const hasBackups = (props.backups?.length ?? 0) > 0;
  return (
    <section class="mlw-box danger">
      <h4>
        <span>{t("about.danger")}</span>
      </h4>
      <ul class="mlw-acts">
        <li>
          <div>
            <strong>{t("about.delete")}</strong>
            <span>
              {hasBackups
                ? t("about.deleteHint")
                : t("about.deleteHintNoBackup")}
            </span>
          </div>
          <Why why={locked ? t("about.unlockFirst") : undefined}>
            <button
              type="button"
              class="del"
              disabled={locked || !canChange}
              onClick={() =>
                page.foundryAction({
                  action: "deleteWorld",
                  worldId: props.world.id,
                })
              }
            >
              {t("about.deleteOpen")}
            </button>
          </Why>
        </li>
      </ul>
    </section>
  );
}
